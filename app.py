from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from groq import Groq
import json
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
load_dotenv()

#hi

app = Flask(__name__)
CORS(app)

# Initialize the official Groq client
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

@app.route('/')
def index():
    return render_template('index.html')

# Place helper function right here:
def determine_intensity(name, item_type):
    name_lower = name.lower()
    
    # 1. Quizzes, Quick Homework, and Minor Tasks -> Low (Green/Yellow depending on UI)
    if 'quiz' in name_lower or 'homework' in name_lower or item_type == 'ASSIGNMENT':
        return "Low"

    # 2. STEM Heavy Exams & Complex Lab Reports -> High (Red)
    stem_heavy = ['chemistry', 'chem', 'physics', 'math', 'calculus', 'biology', 'bio', 'stem']
    if any(subject in name_lower for subject in stem_heavy) and 'report' not in name_lower:
        return "High"

    # 3. Humanities, Essays, and General Reviews -> Medium (Blue)
    return "Medium"

def reserve_slot(occupied_by_date, date_str, desired_start_min, duration_min, step_min=30, allow_rollover=True):
    """Finds the first (date, start-minute-of-day) at or after
    (date_str, desired_start_min) that doesn't overlap anything already
    placed on THAT date -- then reserves it. Returns (final_date_str, start_min).

    Collision-checking is GLOBAL: milestones and study blocks from every item
    share the same `occupied_by_date` map, so nothing gets scheduled on top
    of anything else regardless of which item or loop iteration put it there.

    allow_rollover controls what happens when a slot doesn't fit before
    midnight: True (default, used for study blocks) rolls over to the NEXT
    calendar date -- a night-owl's 10PM block that runs 2 hours actually
    ends at 12AM the NEXT day, not back at the start of the day it began on.
    False (used for exam/assignment milestones) instead clamps to the latest
    possible same-day slot, since a milestone's date is the actual due date
    and must never silently drift to a different calendar day just because
    its preferred hour was taken.
    """
    current_date = datetime.strptime(date_str, "%Y-%m-%d")
    start = max(0, desired_start_min)

    def day_slots_for(d_str):
        return occupied_by_date.setdefault(d_str, [])

    def overlaps(d_str, s, e):
        return any(s < existing_e and e > existing_s for (existing_s, existing_e) in day_slots_for(d_str))

    # Generous cap so a genuinely packed day (or two) doesn't loop forever --
    # this is only a safety valve against truly impossible density.
    max_attempts = (24 * 60 // step_min) * 3 + 5
    attempts = 0

    while True:
        if start + duration_min > 24 * 60:
            if allow_rollover:
                # Doesn't fit before midnight on this date -- roll to the
                # next calendar date and keep searching from its start,
                # instead of wrapping back to hour 0 of THIS date (which
                # used to relabel a block as happening earlier the same
                # day -- sometimes right on top of the block right before it).
                current_date += timedelta(days=1)
                start = 0
            else:
                start = max(0, 24 * 60 - duration_min)

        cur_date_str = current_date.strftime("%Y-%m-%d")
        end = start + duration_min

        if not overlaps(cur_date_str, start, end):
            day_slots_for(cur_date_str).append((start, end))
            return cur_date_str, start

        start += step_min
        attempts += 1
        if attempts > max_attempts:
            # Give up searching -- place it anyway rather than loop forever.
            day_slots_for(cur_date_str).append((start, end))
            return cur_date_str, start

def extract_standardized_routine(raw_prompt):
    if not raw_prompt:
        return []

    system_prompt = """Extract recurring routine commitments (school, fixed sports, jobs) into structured JSON.
Return JSON with this EXACT key:
{
  "routine_blocks": [
    {"days": ["MON", "TUE", "WED", "THU", "FRI"], "start_time": "08:30", "end_time": "15:00", "title": "School Hours"},
    {"days": ["TUE", "THU"], "start_time": "16:00", "end_time": "17:30", "title": "Soccer Practice"}
  ]
}"""

    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": raw_prompt}
            ],
            temperature=0.0,
            response_format={"type": "json_object"}
        )
        raw_json = json.loads(response.choices[0].message.content)
        return raw_json.get("routine_blocks", [])
    except Exception as e:
        print("Failed to parse routine string:", e)
        return []

def calculate_schedule_engine(assessments, user_profile, current_date_str):
    print("\n--- DEBUG START ---")
    print("USER PROFILE RECEIVED:", user_profile)
    print("ASSESSMENTS RECEIVED:", assessments)
    print("CURRENT DATE:", current_date_str)

    user_profile = user_profile or {}
    tasks = []

    try:
        current_date = datetime.strptime(current_date_str, "%Y-%m-%d")
    except Exception:
        current_date = datetime.now()
        current_date_str = current_date.strftime("%Y-%m-%d")

    raw_span = user_profile.get('attentionSpan', 30)
    try:
        session_len = int(raw_span)
    except (ValueError, TypeError):
        session_len = 30

    chronotype = str(user_profile.get('chronotype', 'morning')).lower()
    strategy = str(user_profile.get('procrastinationStyle', 'front')).lower()
    no_go_zone = str(user_profile.get('noGoZone', '')).lower()
    
    raw_routine = user_profile.get("rawRoutinePrompt", "")
    routine_blocks = extract_standardized_routine(raw_routine)
    print("PARSED ROUTINE BLOCKS:", routine_blocks)

    base_start_hour = 20 if 'night' in chronotype else (13 if 'afternoon' in chronotype else 6)

    # Shared across every item and every block below -- this is what lets
    # collision-checking actually be global instead of per-item.
    occupied_by_date = {}

    for item_idx, item in enumerate(assessments):
        if not isinstance(item, dict):
            continue

        item_name = str(item.get("name", "Event"))
        item_date_str = str(item.get("date", current_date_str))
        item_type = str(item.get("type", "EXAM")).upper()
        
        # Check if custom time/duration was extracted (e.g. for ECs or Job shifts)
        custom_time = item.get("time")
        custom_duration = item.get("duration", 60)
        try:
            custom_duration = int(custom_duration)
        except (ValueError, TypeError):
            custom_duration = 60

        try:
            target_date = datetime.strptime(item_date_str, "%Y-%m-%d")
        except (ValueError, TypeError):
            target_date = current_date + timedelta(days=3)
            item_date_str = target_date.strftime("%Y-%m-%d")

        task_intensity = determine_intensity(item_name, item_type)

        # 1. Milestone / EC Placement
        if custom_time:
            try:
                h, m = str(custom_time).split(':')
                desired_start_min = int(h) * 60 + int(m)
            except (ValueError, TypeError):
                desired_start_min = base_start_hour * 60
        else:
            milestone_hour = (base_start_hour + item_idx) % 24
            desired_start_min = milestone_hour * 60

        # FIX: this used to just take desired_start_min as-is, with nothing
        # checking whether some OTHER item's milestone or study blocks had
        # already claimed that time on this date -- e.g. one exam's default
        # placement landing directly on top of a different assignment's prep
        # block. reserve_slot walks forward to the next actually-free time.
        # allow_rollover=False: a milestone's date is the real due date, so
        # if its hour is taken it should get pushed later THAT day, never
        # bumped to a different calendar date.
        actual_date_str, actual_start_min = reserve_slot(occupied_by_date, item_date_str, desired_start_min, custom_duration, allow_rollover=False)
        event_time = f"{actual_start_min // 60:02d}:{actual_start_min % 60:02d}"

        prefix = "⚡ " if item_type in ["EC", "EVENT", "WORK"] else "🎯 "
        clean_title = prefix + str(item_name)

        tasks.append({
            "type": item_type,
            "date": actual_date_str,
            "time": event_time,
            "duration": custom_duration,
            "intensity": task_intensity,
            "title": clean_title
        })

        # Skip generating study blocks for ECs/Events—only create study blocks for academic tasks
        if item_type in ["EC", "EVENT", "WORK"]:
            continue
        
        # 1. Determine the start of the study period for this batch of assessments
        # Parse all assessment dates to find the earliest target date in the request
        all_dates = []
        for a in assessments:
            try:
                all_dates.append(datetime.strptime(a.get("date", current_date_str), "%Y-%m-%d"))
            except (ValueError, TypeError):
                pass
        
        earliest_target = min(all_dates) if all_dates else target_date
        
        # Define a reasonable local window (e.g., 7 days before the earliest test, or current_date if closer)
        window_start = max(current_date, earliest_target - timedelta(days=7))
        
        # Calculate available prep days between window_start and target_date
        available_days = (target_date - window_start).days
        if available_days <= 0:
            available_days = 1

        # 2. Dynamic Strategy (No hardcoded days, bounded to max 3 prep days per subject)
        if strategy == "front":
            # Pick the first 2-3 available days in the window
            num_days = min(3, available_days)
            prep_days = [window_start + timedelta(days=i) for i in range(num_days)]
            blocks_per_day = 3

        elif strategy == "pressure":
            # Pick the last 2 days right before target_date
            num_days = min(2, available_days)
            prep_days = [target_date - timedelta(days=i) for i in range(1, num_days + 1)]
            prep_days.reverse()
            blocks_per_day = 3

        else:
            # Even Spacer: Pick up to 3 days spaced across the available window
            step = max(1, available_days // 3)
            prep_days = [window_start + timedelta(days=i) for i in range(0, available_days, step)][:3]
            blocks_per_day = 2

        # Generate Sequential Study Blocks
        block_counter = 1

        for day_idx, day in enumerate(prep_days):
            date_str = day.strftime("%Y-%m-%d")
            start_hour = base_start_hour

            is_weekend = day.weekday() in [5, 6]
            if is_weekend and no_go_zone == "weekend-morning":
                start_hour = max(13, base_start_hour)

            # If weekday, ensure study start hour starts past school (5 PM / 17:00)
            if not is_weekend and raw_routine:
                start_hour = max(17, base_start_hour)

            # (collision-avoidance now comes entirely from reserve_slot /
            # occupied_by_date below, which is why there's no longer a need
            # to count existing_blocks here for spacing purposes.)

            for b in range(blocks_per_day):
                # FIX: this used to compute each block's start time purely
                # from its own position in THIS item's own loop
                # (start_hour + offset), with zero awareness of what any
                # OTHER item's milestone or study blocks had already
                # claimed on this date -- e.g. two unrelated assignments'
                # prep blocks both gravitating toward the same
                # base_start_hour and landing directly on top of each
                # other. reserve_slot checks against the shared
                # occupied_by_date map (every milestone and block placed so
                # far, from every item) and walks forward to the next
                # actually-free slot instead.
                desired_start_min = (start_hour * 60) + (b * session_len)
                # allow_rollover defaults True here: a study block spilling
                # past midnight should land on the NEXT calendar date, not
                # get relabeled as an earlier slot on the same date it started.
                actual_date_str, actual_start_min = reserve_slot(occupied_by_date, date_str, desired_start_min, session_len, step_min=min(30, session_len))
                task_hour = actual_start_min // 60
                task_minute = actual_start_min % 60

                tasks.append({
                    "type": "STUDY_BLOCK",
                    "date": actual_date_str,
                    "time": f"{task_hour:02d}:{task_minute:02d}",
                    "duration": session_len,
                    "intensity": task_intensity,
                    "title": f"Block {block_counter}: {item_name} Prep"
                })
                
                block_counter += 1

    return tasks

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json or {}
        user_message = data.get("message", "").strip()
        user_profile = data.get("profile", {})
        
        current_date = datetime.now().strftime("%Y-%m-%d")

        print("\n==========================================")
        print(f"📥 RECEIVED FROM JS: '{user_message}'")
        print("==========================================")

        if not user_message:
            return jsonify({
                "status": "success",
                "reply": "I didn't receive any text in that message! Try typing your assignment details again.",
                "tasks": []
            })

        # LAYER 1: FLEXIBLE MULTI-ENTITY EXTRACTION
        intent_prompt = f"""You are a helper that extracts study assignments and exams from user messages.
Today is {current_date} (Year: 2026).

Extract every single test, report, essay, or homework mentioned.
Convert date expressions like "August 24th" or "Aug 27" to "2026-08-24" or "2026-08-27".

Return JSON with this EXACT structure:
{{{{
  "assessments": [
    {{"name": "Advanced Functions Polynomial Quiz", "date": "2026-11-12", "type": "EXAM"}},
    {{"name": "Robotics CAD Demo", "date": "2026-11-10", "type": "EC", "time": "16:00", "duration": 120}},
    {{"name": "Part-Time Job Shift", "date": "2026-11-14", "type": "EC", "time": "13:00", "duration": 240}}
  ]
}}}}"""

        assessments = []
        try:
            res_intent = client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=[
                    {"role": "system", "content": intent_prompt},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.0,
                response_format={"type": "json_object"}
            )
            
            raw_text = res_intent.choices[0].message.content
            print("🤖 RAW GROQ EXTRACTION:", raw_text)
            
            clean_text = raw_text.replace("```json", "").replace("```", "").strip()
            raw_json = json.loads(clean_text)
            assessments = raw_json.get("assessments", [])
            print(f"✅ PARSED ASSESSMENTS COUNT: {len(assessments)}")
        except Exception as pe:
            print(f"❌ Layer 1 Extraction Error: {pe}")

        # LAYER 2: Python Engine
        calculated_tasks = calculate_schedule_engine(assessments, user_profile, current_date)

        if not assessments:
            reply_text = "I couldn't detect specific subject dates in that message. Try specifying dates like 'Chemistry report on Aug 24 and History exam on Aug 27'."
        else:
            reply_text = f"Scheduled {len(assessments)} milestone events and study sessions!"

        return jsonify({
            "status": "success",
            "reply": reply_text,
            "tasks": calculated_tasks
        })

    except Exception as e:
        print(f"🔥 Server Error: {e}")
        return jsonify({"status": "error", "reply": "Server error", "tasks": []}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)