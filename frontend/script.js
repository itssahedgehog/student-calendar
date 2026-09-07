let chatHistory = []; // <-- Add this at the very top of your file

// Universal Academic Board Subject Classification Matrix
const SUBJECT_CATEGORIES = {
    stem: [
        "math", "mathematics", "calculus", "algebra", "geometry", "trigonometry", "statistics",
        "science", "physics", "chemistry", "biology", "kinetics", "equilibrium"
    ],
    humanities: [
        "history", "geography", "civics", "economics", "social studies",
        "english", "literature", "essay", "critical analysis", "reading"
    ],
    languages: [
        "spanish", "french", "german", "mandarin", "chinese", "latin",
        "art", "music", "drama", "elective"
    ]
};

// ==========================================
// CENTRAL GLOBAL AGENT DATA ARCHITECTURE
// ==========================================
window.currentOnboardingStep = 0;
window.onboardingAnswers = {};window.onboardingQuestions = 
[
    {
        id: "chronotype",
        title: "🌅 When does your brain function best?",
        desc: "We will book your high-energy study blocks during these peak hours.",
        options: [
            { text: "Early Morning Grinder", val: "morning" },
            { text: "Afternoon Steady Zone", val: "afternoon" },
            { text: "Late Night Owl", val: "night" }
        ]
    },
    {
        id: "drainingSubjects",
        title: "📚 Which subject drains your battery fastest?",
        desc: "Tasks matching this topic automatically start as 'High Energy' difficulty.",
        options: [
            { text: "STEM (Math / Science)", val: "stem" },
            { text: "Humanities (History / English)", val: "humanities" },
            { text: "Languages / Electives", val: "languages" }
        ]
    },
    {
        id: "attentionSpan",
        title: "⏱️ What is your deep focus time limit?",
        desc: "Tells the AI how small to slice tasks before your brain gets fried.",
        options: [
            { text: "30-Min Hyper Sprints", val: 30 },
            { text: "1-Hour Steady Blocks", val: 60 },
            { text: "2-Hour Deep Dives", val: 120 }
        ]
    },
    {
        id: "noGoZone",
        title: "🚫 Choose your preferred weekly rest window:",
        desc: "The AI scheduling engine will treat this block as a solid wall.",
        options: [
            { text: "Friday Nights Completely Off", val: "friday-night" },
            { text: "Weekend Mornings Off", val: "weekend-morning" },
            { text: "Keep Evenings Clear", val: "evenings" }
        ]
    },
    {
        id: "procrastinationStyle",
        title: "📈 How do you handle approaching deadlines?",
        desc: "Dictates the timeline distribution density of your custom schedule.",
        options: [
            { text: "Front-Loader (Finish early to relax)", val: "front" },
            { text: "Even-Spacer (Perfect daily micro-doses)", val: "even" },
            { text: "Pressure Cooker (Thrive under close stress)", val: "pressure" }
        ]
    },
    {
        id: "escapeHatch",
        title: "🧼 What is your go-to low-energy task?",
        desc: "When catching up on missed days, the AI bumps these first.",
        options: [
            { text: "Organizing notes & folders", val: "organize" },
            { text: "Reviewing basic vocabulary/flashcards", val: "flashcards" },
            { text: "Watching brief video summaries", val: "videos" }
        ]
    },
    {
        id: "bufferPreference",
        title: "🧠 How do you prefer to chain hard tasks?",
        desc: "Determines whether back-to-back study spacing gets empty break gaps.",
        options: [
            { text: "Power Through (Zero breaks, finish fast)", val: "none" },
            { text: "Breather Mode (15-min gaps between blocks)", val: "break" },
            { text: "Alternating Pattern (Follow hard with easy work)", val: "alternate" }
        ]
    },
    {
        id: "rawRoutinePrompt",
        title: "🗓️ What is your fixed weekly routine?",
        desc: "Type out your usual school hours, regular extracurriculars, or work shifts.",
        isTextInput: true, // Marker for text area rendering
        placeholder: "e.g., School weekdays 8:30 AM to 3:00 PM. Soccer practice Tuesdays and Thursdays 4:00 PM to 5:30 PM."
    }
];

const sendButton = document.getElementById("send-btn");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.querySelector(".chat-messages");

const prevButton = document.getElementById('prev-btn');
const nextButton = document.getElementById('next-btn');
const dayBoxes = document.querySelectorAll('.day-column');

const eventModal = document.getElementById('event-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalDayTitle = document.getElementById('modal-day-title');

// 1. LOWER-LEVEL HELPER FUNCTIONS FIRST (Fixes initialization crashes)
function getStartOfWeek(date) {
    const currentDay = date.getDay(); // 0 is Sunday, 1 is Monday...
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() + distanceToMonday);
    
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
}

// Master date tracker: Holds the exact Monday date representing the top-left calendar box
let currentCalendarStart = getStartOfWeek(new Date());

function getCalendarDateString(daysOffset) {
    const d = new Date(currentCalendarStart);
    d.setDate(currentCalendarStart.getDate() + daysOffset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

let calendarTasks = JSON.parse(localStorage.getItem('calendarTasks')) || [];

// 2. CHAT HISTORY INITIALIZATION
let savedMessages = JSON.parse(localStorage.getItem('chatHistory')) || [];

function renderNewMessage(text) {
    const userMessage = document.createElement('p');
    userMessage.classList.add('message');
    userMessage.classList.add('user-message');
    userMessage.textContent = text;
    chatMessages.appendChild(userMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

savedMessages.forEach(msg => {
    renderNewMessage(msg);
});

// 3. CORE CHAT COMMAND ENGINE (With Fixed Word Slicing Index)
// ==========================================
// CORE CHAT COMMAND ENGINE (Fully Repaired & Safe)
// ==========================================
async function handleSendMessage() {
    const messageText = chatInput.value.trim();
    if (!messageText) return;

    // 1. Display the user's typed text instantly in the chat pane
    const userMsg = document.createElement('div');
    userMsg.classList.add('message', 'user-message');
    userMsg.textContent = messageText;
    chatMessages.appendChild(userMsg);
    chatInput.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 2. INTERCEPT LOCAL CALENDAR COMMANDS FIRST
    if (messageText.startsWith("add task ")) {
        const parts = messageText.split(" ");
        const targetDateStr = parts[2]; 
        const targetTimeSlot = parts[3]; 
        
        let targetDuration = 60; 
        let targetEnergy = "Medium"; 
        let titleStartIndex = 4;

        if (parts[4] && !isNaN(parts[4])) {
            targetDuration = parseInt(parts[4]);
            titleStartIndex = 5;
            
            if (parts[5] && ["High", "Medium", "Low"].includes(parts[5])) {
                targetEnergy = parts[5];
                titleStartIndex = 6;
            }
        } 
        else if (parts[4] && ["High", "Medium", "Low"].includes(parts[4])) {
            targetEnergy = parts[4];
            titleStartIndex = 5;
        }

        const taskTitle = parts.slice(titleStartIndex).join(" "); 

        if (targetDateStr && targetTimeSlot && taskTitle) {
            calendarTasks.push({
                dateStr: targetDateStr,
                timeSlot: targetTimeSlot,
                duration: targetDuration,
                energy: targetEnergy,
                title: taskTitle,
                notes: "",
                resources: []
            });
            saveAndRefresh();
        }
        return; 
    }
    
    else if (messageText.startsWith("move task ")) {
        const content = messageText.replace("move task ", "").trim();
        const parts = content.split("|").map(p => p.trim());
        if (parts.length === 2) {
            const task = calendarTasks.find(t => 
                t.title === droppedTaskData.title && 
                t.dateStr === droppedTaskData.dateStr && 
                t.timeSlot === droppedTaskData.timeSlot
            );
            const dynamicDetails = parts[1].split(" ");
            if (task && dynamicDetails.length === 2) {
                task.dateStr = dynamicDetails[0];
                task.timeSlot = dynamicDetails[1];
                
                if (!task.duration) task.duration = 60;
                if (!task.energy) task.energy = "Medium";
                
                saveAndRefresh();
            }
        }
        return; 
    }

    // 3. ROUTE NATURAL TEXT TO LOCAL PYTHON FLASK BACKEND
    try {
        // Fetch the complete saved profile object from onboarding
        const savedProfile = localStorage.getItem("userPersonalityProfile");
        const userProfile = savedProfile ? JSON.parse(savedProfile) : {};

        console.log("Sending Profile to Flask:", userProfile);

        const loadingMsg = document.createElement('div');
        loadingMsg.classList.add('message', 'ai-message');
        loadingMsg.style.fontStyle = 'italic';
        loadingMsg.style.color = '#64748b';
        loadingMsg.textContent = "AI is thinking...";
        chatMessages.appendChild(loadingMsg);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        if (chatHistory.length > 8) {
            chatHistory = chatHistory.slice(-4); 
        }

        const response = await fetch('http://127.0.0.1:5000/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: messageText,
                profile: userProfile,
                history: chatHistory 
            })
        });

        const data = await response.json();
        
        if (loadingMsg.parentNode) {
            chatMessages.removeChild(loadingMsg);
        }

        if (data.status === "success") {
            let aiReplyText = data.reply;
            
            // =========================================================
            // 1. RENDER CHAT DISPLAY BUBBLE (EXACTLY ONCE)
            // =========================================================
            if (aiReplyText && aiReplyText.trim().length > 0) {
                // Save a clean copy into conversation history array
                chatHistory.push({ role: "assistant", content: aiReplyText });

                const aiMsg = document.createElement('div');
                aiMsg.classList.add('message', 'ai-message');
                aiMsg.textContent = aiReplyText; 
                chatMessages.appendChild(aiMsg);
            }

            // =========================================================
            // 2. RENDER CALENDAR FROM CLEAN BACKEND STRUCTS
            // =========================================================
            if (data.tasks && Array.isArray(data.tasks)) {
                console.log("Tasks received for calendar:", data.tasks); // Open browser inspect console to verify!
                data.tasks.forEach(task => {
                    console.log("Adding structured block from JSON payload:", task);
                    
                    let date = task.date;
                    let time = task.time;
                    let duration = task.duration;
                    let title = task.title ? task.title.trim() : "Study Session";
                    
                    // Fetch profile selection rules dynamically
                    const userDrainingProfile = window.onboardingAnswers?.drainingSubjects || "stem";
                    const lowerTitle = title.toLowerCase();
                    const targetKeywords = SUBJECT_CATEGORIES[userDrainingProfile] || [];
                    const matchesDraining = targetKeywords.some(keyword => lowerTitle.includes(keyword));
                    
                    let intensity = task.intensity ? task.intensity.trim() : "Medium";
                    if (matchesDraining) {
                        intensity = "High";
                    } else {
                        intensity = intensity.charAt(0).toUpperCase() + intensity.slice(1).toLowerCase();
                    }

                    let taskType = task.type ? task.type.trim().toUpperCase() : "STUDY_BLOCK";

                    if (typeof handleAddTask === 'function') {
                        handleAddTask(date, time, duration, intensity, title, taskType);
                    }
                });
            }
        }

    } catch (error) {
        console.error("Network connectivity crash error:", error);
        const loader = chatMessages.querySelector('.ai-message[style*="italic"]');
        if (loader) loader.remove();

        const errorMsg = document.createElement('div');
        errorMsg.classList.add('message', 'ai-message');
        errorMsg.style.borderColor = '#ef4444';
        errorMsg.textContent = "⚠️ Can't reach the local server brain! Make sure your black command prompt window is still running app.py on port 5000.";
        chatMessages.appendChild(errorMsg);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function saveAndRefresh() {
    localStorage.setItem('calendarTasks', JSON.stringify(calendarTasks));
    renderTasks();
    document.getElementById('event-modal').style.display = 'none';
}

sendButton.addEventListener('click', handleSendMessage);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSendMessage(); });

// 4. MAIN CALENDAR DRAW COMPONENT
function renderTasks() {
    dayBoxes.forEach(box => {
        const container = box.querySelector('.tasks-container');
        if (container) container.innerHTML = '';
    });

    dayBoxes.forEach((box, index) => {
        const boxDate = new Date(currentCalendarStart);
        boxDate.setDate(currentCalendarStart.getDate() + index);
        
        const year = boxDate.getFullYear();
        const month = String(boxDate.getMonth() + 1).padStart(2, '0');
        const day = String(boxDate.getDate()).padStart(2, '0');
        const boxDateString = `${year}-${month}-${day}`;

        const matchingTasks = calendarTasks.filter(task => task.dateStr === boxDateString);
        const container = box.querySelector('.tasks-container');

        if (container) {
            matchingTasks.forEach(task => {
                const bubble = document.createElement('div');
                bubble.classList.add('task-bubble');

                // FIX: bubble height used to scale linearly with duration
                // (e.g. a 90-min task computed to ~200px, a 2hr task ~232px).
                // In this compact biweekly grid that's wrong on two counts:
                // 1) .day-column sits in a CSS grid with fixed 1fr rows, and
                //    .tasks-container has no overflow rule, so anything taller
                //    than the available row just spills through and overlaps
                //    the day-column below it instead of being contained.
                // 2) duration is already shown in the subtitle line, so the
                //    box doesn't need to grow to communicate it.
                // Fixed, comfortable height regardless of duration. Long days
                // now scroll inside their own cell instead of overflowing it
                // (see .tasks-container overflow-y in style.css).
                const FIXED_BUBBLE_HEIGHT = 58;

                bubble.style.setProperty("min-height", `${FIXED_BUBBLE_HEIGHT}px`, "important");
                bubble.style.setProperty("height", "auto", "important");
                bubble.style.setProperty("max-height", "none", "important");
                bubble.style.setProperty("overflow", "hidden", "important");
                bubble.style.setProperty("width", "100%", "important");
                bubble.style.setProperty("max-width", "100%", "important");
                bubble.style.setProperty("padding", "6px 8px", "important");
                bubble.style.setProperty("border-radius", "6px", "important");
                bubble.style.setProperty("box-sizing", "border-box", "important");
                bubble.style.setProperty("flex-shrink", "0", "important");

                bubble.style.position = "relative";
                bubble.style.display = "flex";
                bubble.style.flexDirection = "column";
                bubble.style.justifyContent = "space-between";

                // Fixed 3-line clamp for every task, independent of duration --
                // a long task no longer needs a taller box to show its full
                // title, it just gets the same comfortable 3 lines as everything else.
                const maxLines = "3";

                bubble.innerHTML = `
                    <div style="
                        font-weight: 700; 
                        font-size: 0.72rem; 
                        line-height: 1.2; 
                        word-break: break-word; 
                        overflow-wrap: anywhere; 
                        color: #f8fafc; 
                        max-width: 100%;
                        display: -webkit-box;
                        -webkit-line-clamp: ${maxLines};
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: normal !important;
                    ">
                        ${task.title}
                    </div>
                    <div style="
                        font-size: 0.6rem; 
                        opacity: 0.85; 
                        color: #cbd5e1; 
                        margin-top: 2px; 
                        white-space: nowrap !important; 
                        position: static !important; 
                        flex-shrink: 0;
                    ">
                        ⏰ ${task.timeSlot || 'Flex'} (${task.duration || 30}m)
                    </div>
                `;

                // Set task type background styling
                if (task.type === "EXAM") {
                    bubble.style.borderLeft = "5px solid #ef4444";
                    bubble.style.backgroundColor = "#450a0a";
                } else if (task.type === "ASSIGNMENT") {
                    bubble.style.borderLeft = "5px solid #f59e0b";
                    bubble.style.backgroundColor = "#451a03";
                } else if (task.type === "EXTRACURRICULAR") {
                    bubble.style.borderLeft = "5px solid #10b981";
                    bubble.style.backgroundColor = "#064e3b";
                } else {
                    bubble.style.borderLeft = "5px solid #38bdf8";
                    bubble.style.backgroundColor = "#0c4a6e";
                }

                // Set intensity accent styling
                const energyLevel = (task.energy || task.intensity || "").toLowerCase();
                if (energyLevel === "high") {
                    bubble.style.borderLeft = "5px solid #ef4444";
                } else if (energyLevel === "medium") {
                    bubble.style.borderLeft = "5px solid #f59e0b";
                } else if (energyLevel === "low") {
                    bubble.style.borderLeft = "5px solid #10b981";
                }

                bubble.draggable = true;
                bubble.addEventListener('dragstart', (event) => {
                    event.dataTransfer.setData('text/plain', JSON.stringify(task));
                });

                container.appendChild(bubble);
            });
        }
    });
}

// Row pitch shared between the row shells and the task overlays below, so a
// task's absolute height/top always lines up with real row boundaries.
const DAILY_ROW_HEIGHT = 52;
const DAILY_ROW_GAP = 4;

// Builds one empty hour-row "shell" (time label + background slot). No task
// is drawn inside it anymore -- tasks are drawn as overlays on the column
// wrapper instead, see buildTaskOverlay() below.
function defHtmlRow(displayTime, timeString, boxIndex) {
    return `
<div class="timeline-hour-row" data-time-slot="${timeString}" data-box-origin="${boxIndex}" style="display: flex; box-sizing: border-box; border-bottom: 1px solid #1e293b; padding: 8px 0; align-items: stretch; gap: 10px; height: ${DAILY_ROW_HEIGHT}px; position: relative;">
    <span style="width: 50px; color: #64748b; font-size: 0.75rem; font-weight: 600; text-align: right; display: flex; align-items: center; justify-content: flex-end; flex-shrink: 0; user-select: none;">${displayTime}</span>
    <div class="inner-drop-zone" style="flex-grow: 1; border-radius: 4px; padding: 4px; transition: background 0.2s; width: calc(100% - 60px); display: flex; align-items: center;">
        <span style="color: #2a3547; font-size: 0.8rem; font-style: italic; user-select: none;">--</span>
    </div>
</div>`;
}

// Groups time-overlapping segments into clusters, then greedily assigns
// each one a lane within its cluster so overlapping tasks sit SIDE BY SIDE
// instead of being drawn directly on top of one another (which just paints
// over whichever one happened to render first -- the "overlap" bug). A
// segment with nothing else overlapping it ends up alone in its own
// cluster (laneCount = 1) and keeps the column's full width, same as before.
function assignOverlapLanes(segments) {
    const sorted = [...segments].sort((a, b) => a.segStart - b.segStart);

    // 1. Group into clusters of mutually-touching segments.
    const clusters = [];
    let current = [];
    let clusterEnd = -Infinity;

    sorted.forEach(seg => {
        if (current.length === 0 || seg.segStart < clusterEnd) {
            current.push(seg);
            clusterEnd = Math.max(clusterEnd, seg.segEnd);
        } else {
            clusters.push(current);
            current = [seg];
            clusterEnd = seg.segEnd;
        }
    });
    if (current.length > 0) clusters.push(current);

    // 2. Within each cluster, greedily assign the lowest lane that's free
    // by the time this segment starts (classic interval-scheduling layout).
    clusters.forEach(cluster => {
        const laneEnds = []; // laneEnds[i] = end time of the last segment placed in lane i
        cluster.forEach(seg => {
            let lane = laneEnds.findIndex(end => end <= seg.segStart);
            if (lane === -1) {
                lane = laneEnds.length;
                laneEnds.push(seg.segEnd);
            } else {
                laneEnds[lane] = seg.segEnd;
            }
            seg.laneIndex = lane;
        });
        cluster.forEach(seg => { seg.laneCount = laneEnds.length; });
    });

    return sorted;
}

// Builds one SEGMENT of a task, absolutely positioned against the COLUMN
// wrapper. A task is drawn once per column it overlaps, each call sized to
// only the portion of its duration that falls inside that column -- so a
// task that starts in "Early Morning" and runs into "Daytime" gets two
// segments, each spanning real row-heights in its own column, instead of
// being clipped at the bottom of the column it started in. When laneCount > 1
// (this segment genuinely overlaps another task in time), it only takes its
// share of the width, side-by-side with the other lane(s), instead of the
// full width -- see assignOverlapLanes() above.
function buildTaskOverlay(t, topPx, heightPx, boxIndex, isContinuation, isTruncated, laneIndex, laneCount) {
    let energyColor = "#0284c7";
    let borderAccent = "#38bdf8";

    const energyLevel = (t.energy || t.intensity || "").toLowerCase();
    if (energyLevel === "high") {
        energyColor = "#450a0a";
        borderAccent = "#ef4444";
    } else if (energyLevel === "low") {
        energyColor = "#064e3b";
        borderAccent = "#10b981";
    }

    const durationMins = parseInt(t.duration) || 60;

    // A continuation segment (task started in a previous column) loses its
    // top-left rounding and gets a dashed top edge to read as "picks up from
    // the left". A truncated segment (continues into the next column) loses
    // bottom-left rounding and gets a dashed bottom edge. This is purely a
    // visual cue -- both segments are the same underlying task.
    const topLeftRadius = isContinuation ? "0" : "6px";
    const bottomLeftRadius = isTruncated ? "0" : "6px";
    const topBorder = isContinuation ? `border-top: 2px dashed ${borderAccent};` : "";
    const bottomBorder = isTruncated ? `border-bottom: 2px dashed ${borderAccent};` : "";

    const lanes = laneCount || 1;
    const lane = laneIndex || 0;
    const LANE_GAP = 4;

    // left/width are computed against the drop-zone area only (the 60px
    // hour-label column is excluded), so overlapping tasks split the
    // remaining width evenly instead of overlapping it.
    const leftCss = `calc(60px + (100% - 60px) * ${lane / lanes})`;
    const widthCss = lanes > 1
        ? `calc((100% - 60px) / ${lanes} - ${LANE_GAP}px)`
        : `calc(100% - 60px)`;

    const dynamicStyle = `
        top: ${topPx}px;
        height: ${heightPx}px !important;
        min-height: ${heightPx}px !important;
        box-sizing: border-box !important;
        position: absolute !important;
        left: ${leftCss};
        width: ${widthCss};
        z-index: 10;
        background-color: ${energyColor};
        border-left: 5px solid ${borderAccent};
        border-top-left-radius: ${topLeftRadius};
        border-top-right-radius: 6px;
        border-bottom-left-radius: ${bottomLeftRadius};
        border-bottom-right-radius: 6px;
        ${topBorder}
        ${bottomBorder}
        padding: 6px 10px;
        cursor: pointer;
        overflow: hidden;
    `;

    const displayTitle = isContinuation ? `↳ ${t.title}` : t.title;

    return `
        <div class="inner-task-item" 
            data-task-title="${t.title}" 
            data-box-origin="${boxIndex}" 
            data-old-time="${t.timeSlot}" 
            draggable="true" 
            style="${dynamicStyle}">
            <div style="font-weight: 700; font-size: 0.8rem; color: #f8fafc;">${displayTitle}</div>
            <div style="font-size: 0.68rem; opacity: 0.85; color: #cbd5e1; margin-top: 2px;">
                ⚡ ${t.energy || 'Medium'} (${durationMins}m)
            </div>
        </div>
    `;
}

// 5. CALENDAR PAGINATION
function updateCalendarHeaderLabels() {
    dayBoxes.forEach((box, index) => {
        const boxDate = new Date(currentCalendarStart);
        boxDate.setDate(currentCalendarStart.getDate() + index);

        const formattedDate = boxDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });

        const titleSpan = box.querySelector('.day-title');
        if (titleSpan) titleSpan.textContent = formattedDate;
    });
}

nextButton.addEventListener('click', () => {
    currentCalendarStart.setDate(currentCalendarStart.getDate() + 14);
    updateCalendarHeaderLabels();
    renderTasks();
});

prevButton.addEventListener('click', () => {
    currentCalendarStart.setDate(currentCalendarStart.getDate() - 14);
    updateCalendarHeaderLabels();
    renderTasks();
});

// 6. DETAILED DAY TIMELINE AND STUDY PROGRESS PANEL CONTROLLERS
function showIndividualTaskFocus(taskName) {
    const dynamicContent = document.getElementById('modal-dynamic-content');
    const modalTitle = document.getElementById('modal-day-title');
    
    const taskRef = calendarTasks.find(t => t.title === taskName);
    if (!taskRef) return;

    if (taskRef.notes === undefined) taskRef.notes = "";
    if (taskRef.resources === undefined || typeof taskRef.resources === 'string') {
        taskRef.resources = []; 
    }

    modalTitle.textContent = `Task Focus`;
    
    if (dynamicContent) {
        dynamicContent.innerHTML = `
            <div class="modal-content" style="background: #1e293b; padding: 20px; border-radius: 6px; border: 1px solid #334155; display: flex; flex-direction: column; gap: 20px;">
                <h4 style="color: #38bdf8; font-size: 1.25rem; font-weight: 600; margin: 0;">${taskName}</h4>
                
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="color: #94a3b8; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">📝 Study Notes</label>
                    <textarea id="modal-task-notes" placeholder="Type your study notes, goals, or progress updates here..." 
                        style="width: 100%; height: 100px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #f8fafc; padding: 12px; font-size: 0.9rem; resize: none; outline: none; transition: border-color 0.2s; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);">${taskRef.notes}</textarea>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <label style="color: #94a3b8; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">🔗 Saved Workspace Tabs</label>
                    
                    <div style="display: flex; gap: 8px;">
                        <input id="tab-saver-input" type="text" placeholder="Paste link here (e.g., youtube.com, docs.google.com)..." 
                            style="flex-grow: 1; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #f8fafc; padding: 8px 12px; font-size: 0.85rem; outline: none; transition: border-color 0.2s;">
                        <button id="save-tab-btn" style="background: #0284c7; color: #f8fafc; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: background 0.2s;">
                            ＋ Save Link
                        </button>
                    </div>

                    <div id="session-buddy-box" style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px; min-height: 80px; display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);">
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #334155; padding-top: 15px; margin-top: 5px;">
                    <button id="back-to-day-btn" style="background: #334155; color: #f8fafc; border: 1px solid #475569; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; transition: background 0.2s;">
                        ◀ Back to Day Schedule
                    </button>
                    <button id="delete-task-ui-btn" style="background: #b91c1c; color: #f8fafc; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; transition: background 0.2s;">
                        🗑 Delete Task
                    </button>
                </div>
            </div>
        `;

        const notesInput = document.getElementById('modal-task-notes');
        const tabInput = document.getElementById('tab-saver-input');
        const saveTabBtn = document.getElementById('save-tab-btn');

        function renderTabCapsules() {
            const buddyBox = document.getElementById('session-buddy-box');
            if (!buddyBox) return;
            buddyBox.innerHTML = "";

            if (taskRef.resources.length === 0) {
                buddyBox.innerHTML = `<span style="color: #475569; font-size: 0.85rem; font-style: italic; align-self: center; width: 100%; text-align: center; user-select: none;">Workspace is empty. Add links above to save your study tabs!</span>`;
                return;
            }

            taskRef.resources.forEach((url, index) => {
                let secureUrl = url;
                if (!/^https?:\/\//i.test(secureUrl)) {
                    secureUrl = 'https://' + secureUrl;
                }

                try {
                    const domain = new URL(secureUrl).hostname.replace('www.', '');
                    const capsule = document.createElement('div');
                    capsule.style.cssText = "display: flex; align-items: center; background: #1e293b; border: 1px solid #334155; border-radius: 4px; padding: 4px 8px; gap: 6px;";

                    const link = document.createElement('a');
                    link.href = secureUrl;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    link.textContent = `🌐 ${domain}`;
                    link.style.cssText = "color: #38bdf8; font-size: 0.75rem; font-weight: 600; text-decoration: none;";
                    
                    const deleteBtn = document.createElement('span');
                    deleteBtn.textContent = "×";
                    deleteBtn.style.cssText = "color: #64748b; cursor: pointer; font-weight: 700; font-size: 0.9rem; padding: 0 2px; transition: color 0.2s;";
                    
                    deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.color = '#f43f5e');
                    deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.color = '#64748b');
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        taskRef.resources.splice(index, 1);
                        localStorage.setItem('calendarTasks', JSON.stringify(calendarTasks));
                        renderTabCapsules();
                    });

                    capsule.appendChild(link);
                    capsule.appendChild(deleteBtn);
                    buddyBox.appendChild(capsule);
                } catch(e) {}
            });
        }

        renderTabCapsules();

        notesInput.addEventListener('input', () => {
            taskRef.notes = notesInput.value;
            localStorage.setItem('calendarTasks', JSON.stringify(calendarTasks));
        });

        saveTabBtn.addEventListener('click', () => {
            const rawUrl = tabInput.value.trim();
            if (rawUrl === "") return;

            taskRef.resources.push(rawUrl);
            localStorage.setItem('calendarTasks', JSON.stringify(calendarTasks));
            
            tabInput.value = "";
            renderTabCapsules();
        });

        tabInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveTabBtn.click();
        });

        [notesInput, tabInput].forEach(el => {
            el.addEventListener('focus', () => el.style.borderColor = "#38bdf8");
            el.addEventListener('blur', () => el.style.borderColor = "#334155");
        });

        document.getElementById('delete-task-ui-btn').addEventListener('click', () => {
            if (confirm(`Are you sure you want to permanently delete "${taskName}"?`)) {
                calendarTasks = calendarTasks.filter(t => t.title !== taskName);
                saveAndRefresh();
            }
        });
    }
}



// 7. GLOBAL MODAL INTERACTION DISPATCHER (Fixed Event Routing & Multi-Hour Grid)
document.addEventListener('click', (event) => {
    const modalElement = document.getElementById('event-modal');
    const dynamicContent = document.getElementById('modal-dynamic-content');
    const modalTitle = document.getElementById('modal-day-title');

    // 1. Clicked "Back to Day Schedule" button inside Task Focus View
    if (event.target.id === 'back-to-day-btn') {
        event.stopPropagation();
        const originIndex = parseInt(modalElement.getAttribute('data-last-viewed-box'), 10);
        const allBoxes = document.querySelectorAll('.day-column');
        
        if (!isNaN(originIndex) && allBoxes[originIndex]) {
            allBoxes[originIndex].click();
        }
        return;
    }

    // 2. Clicked an Outer Calendar Task Bubble (or any of its inner elements)
    const taskBubble = event.target.closest('.task-bubble');
    if (taskBubble) {
        event.stopPropagation();
        
        // Grab title from inner text node or data attribute
        const titleElement = taskBubble.querySelector('div');
        const taskName = titleElement ? titleElement.textContent.trim() : taskBubble.textContent.trim();
        
        const parentDayBox = taskBubble.closest('.day-column');
        if (parentDayBox && modalElement) {
            const allBoxes = document.querySelectorAll('.day-column');
            const boxIndex = Array.from(allBoxes).indexOf(parentDayBox);
            modalElement.setAttribute('data-last-viewed-box', boxIndex);
        }
        
        showIndividualTaskFocus(taskName);
        if (modalElement) modalElement.style.display = 'flex';
        return;
    }

    // 3. Clicked an Inner Timeline Task Item inside the Daily Planner View
    const clickedInnerTask = event.target.closest('.inner-task-item');
    if (clickedInnerTask) {
        event.stopPropagation();
        modalElement.setAttribute('data-last-viewed-box', clickedInnerTask.getAttribute('data-box-origin'));
        showIndividualTaskFocus(clickedInnerTask.getAttribute('data-task-title'));
        return;
    }

    // 4. Clicked a Day Column Box to open the Daily Planner
    const dayBox = event.target.closest('.day-column');
    if (dayBox && !event.target.classList.contains('task-bubble')) {
        const allBoxes = document.querySelectorAll('.day-column');
        const boxIndex = Array.from(allBoxes).indexOf(dayBox);
        
        const targetDate = new Date(currentCalendarStart);
        targetDate.setDate(currentCalendarStart.getDate() + boxIndex);
        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        const dayLabel = dayBox.querySelector('.day-title').textContent;
        modalTitle.textContent = `Daily Planner — ${dayLabel}`;

        const todaysTasks = calendarTasks.filter(t => t.dateStr === dateString);

        let htmlContent = `
            <div class="full-day-timeline" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 5px 0; max-height: 70vh; overflow-y: auto; padding-right: 8px;">
        `;

        const timeColumns = [
            { title: "Early Morning", color: "#a855f7", startHour: 0, endHour: 7 },
            { title: "Daytime", color: "#38bdf8", startHour: 8, endHour: 15 },
            { title: "Night Shift", color: "#f43f5e", startHour: 16, endHour: 23 }
        ];

        timeColumns.forEach(col => {
            const pitch = DAILY_ROW_HEIGHT + DAILY_ROW_GAP;

            htmlContent += `
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <p style="color: ${col.color}; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #334155; padding-bottom: 4px; margin-bottom: 6px;">${col.title}</p>
                    <div style="display: flex; flex-direction: column; gap: ${DAILY_ROW_GAP}px; position: relative;">
            `;

            // 1. Draw the empty hour-row shells first (these are the fixed-height
            // background grid lines the tasks will be laid on top of).
            for (let hour = col.startHour; hour <= col.endHour; hour++) {
                const displayTime = hour === 0 ? "12 AM" : hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
                const timeSlotStr = `${String(hour).padStart(2, '0')}:00`;
                htmlContent += defHtmlRow(displayTime, timeSlotStr, boxIndex);
            }

            // 2. Compute a segment for every task whose time range OVERLAPS
            // this column's hour range -- not just tasks that started in it.
            // This is what lets a task that starts at, say, 7am and runs 2
            // hours draw a segment in "Early Morning" (7-8am) AND a segment
            // in "Daytime" (8-9am), instead of being clamped inside whichever
            // column it started in.
            const colRangeStart = col.startHour;
            const colRangeEnd = col.endHour + 1; // column covers [startHour, endHour+1)

            const segments = [];
            todaysTasks.forEach(t => {
                if (!t || !t.timeSlot) return;
                const [rawHour, rawMin] = String(t.timeSlot).split(':');
                const startHour = parseInt(rawHour, 10);
                if (isNaN(startHour)) return;
                const startMin = parseInt(rawMin, 10) || 0;

                const taskStart = startHour + (startMin / 60);
                const durationMins = parseInt(t.duration) || 60;
                const taskEnd = taskStart + (durationMins / 60);

                const segStart = Math.max(taskStart, colRangeStart);
                const segEnd = Math.min(taskEnd, colRangeEnd);
                if (segEnd <= segStart) return; // task doesn't touch this column at all

                segments.push({
                    task: t,
                    segStart,
                    segEnd,
                    isContinuation: taskStart < colRangeStart,
                    isTruncated: taskEnd > colRangeEnd
                });
            });

            // 3. Lay segments out into side-by-side lanes wherever two of
            // them genuinely overlap in time, instead of stacking directly
            // on top of each other. Segments with nothing to share time
            // with still get the column's full width, same as before.
            assignOverlapLanes(segments).forEach(seg => {
                const top = (seg.segStart - colRangeStart) * pitch;
                const heightRows = seg.segEnd - seg.segStart;
                const height = Math.max(DAILY_ROW_HEIGHT, (heightRows * pitch) - DAILY_ROW_GAP);

                htmlContent += buildTaskOverlay(seg.task, top, height, boxIndex, seg.isContinuation, seg.isTruncated, seg.laneIndex, seg.laneCount);
            });

            htmlContent += `</div></div>`;
        });

        htmlContent += `</div>`;
        if (dynamicContent) dynamicContent.innerHTML = htmlContent;
        
        modalElement.setAttribute('data-last-viewed-box', boxIndex);
        if (modalElement) modalElement.style.display = 'flex';
        
        setupInnerTimelineDragAndDrop(dateString, dayBox);
    }
});

closeModalBtn.addEventListener('click', () => { document.getElementById('event-modal').style.display = 'none'; });
document.getElementById('event-modal').addEventListener('click', (event) => {
    const modalElement = document.getElementById('event-modal');
    if (event.target === modalElement) modalElement.style.display = 'none';
});

// 8. GRID DRAG AND DROP (CROSS-WEEK CAPABLE)
dayBoxes.forEach((box, destinationIndex) => {
    box.addEventListener('dragover', (event) => { event.preventDefault(); });
    box.addEventListener('drop', (event) => {
        event.preventDefault();
        const taskData = JSON.parse(event.dataTransfer.getData('text/plain'));
        const draggedTask = calendarTasks.find(t => t.title === taskData.title && t.dateStr === taskData.dateStr);

        if (draggedTask) {
            const destinationDate = new Date(currentCalendarStart);
            destinationDate.setDate(currentCalendarStart.getDate() + destinationIndex);

            const year = destinationDate.getFullYear();
            const month = String(destinationDate.getMonth() + 1).padStart(2, '0');
            const day = String(destinationDate.getDate()).padStart(2, '0');
            
            draggedTask.dateStr = `${year}-${month}-${day}`;
            localStorage.setItem('calendarTasks', JSON.stringify(calendarTasks));
            renderTasks();
        }
    });
});

let pageFlipTimeout = null;
[
    { button: prevButton, action: () => prevButton.click() },
    { button: nextButton, action: () => nextButton.click() }
].forEach(target => {
    target.button.addEventListener('dragover', (event) => {
        event.preventDefault();
        if (!pageFlipTimeout) {
            pageFlipTimeout = setTimeout(() => {
                target.action();
                pageFlipTimeout = null;
            }, 800);
        }
    });
    target.button.addEventListener('dragleave', () => {
        if (pageFlipTimeout) {
            clearTimeout(pageFlipTimeout);
            pageFlipTimeout = null;
        }
    });
});

// 9. INTERNAL TIMELINE DROP HANDLER
function setupInnerTimelineDragAndDrop(dateString, originDayBox) {
    const modalContent = document.getElementById('modal-dynamic-content');
    if (!modalContent) return;

    const taskItems = modalContent.querySelectorAll('.inner-task-item');
    const hourRows = modalContent.querySelectorAll('.timeline-hour-row');

    taskItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            e.dataTransfer.setData('text/inner-title', item.getAttribute('data-task-title'));
            e.dataTransfer.setData('text/inner-oldtime', item.getAttribute('data-old-time'));
        });
    });

    hourRows.forEach(row => {
        const dropZone = row.querySelector('.inner-drop-zone');
        
        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (dropZone) dropZone.style.background = "#1e293b";
        });
        row.addEventListener('dragleave', () => {
            if (dropZone) dropZone.style.background = "transparent";
        });
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            if (dropZone) dropZone.style.background = "transparent";

            const draggedTitle = e.dataTransfer.getData('text/inner-title');
            const newTime = row.getAttribute('data-time-slot');

            if (draggedTitle && newTime) {
                const targetTask = calendarTasks.find(t => t.title === draggedTitle && t.dateStr === dateString);
                if (targetTask) {
                    targetTask.timeSlot = newTime;
                    localStorage.setItem('calendarTasks', JSON.stringify(calendarTasks));
                    renderTasks();
                    originDayBox.click();
                }
            }
        });
    });
}


// ==========================================
// 3. PERSONALITY ONBOARDING STATE MACHINE
// ==========================================
let currentOnboardingStep = 0;
const onboardingAnswers = {};

// Global tracking states (Make sure these are at the top of your file or right above the function)
if (typeof currentOnboardingStep === 'undefined') window.currentOnboardingStep = 0;
if (typeof onboardingAnswers === 'undefined') window.onboardingAnswers = {};

function renderOnboardingStep() {
    const qBox = document.getElementById("onboarding-question-box");
    const indicator = document.getElementById("onboarding-step-indicator");
    const bar = document.getElementById("onboarding-progress-bar");
    const backBtn = document.getElementById("onboarding-back-btn");
    const nextBtn = document.getElementById("onboarding-next-btn");

    if (!qBox) return;

    // SELF-CONTAINED DATA ARRAY TO PREVENT MISSING VARIABLE CRASHES
    const localQuestions = [
        { id: "chronotype", title: "When does your brain function best?", desc: "We will place heavy tasks during your high-energy windows.", options: [{ text: "Early Morning (☀️ Morning Lark)", val: "morning" }, { text: "Mid-Day / Afternoon (🌤️ Productive Bird)", val: "afternoon" }, { text: "Late Night (🌙 Night Owl)", val: "night" }] },
        { id: "attentionSpan", title: "What is your maximum uninterrupted focus limit?", desc: "Your schedule will break assignments into these exact chunks.", options: [{ text: "30 Minutes", val: 30 }, { text: "60 Minutes", val: 60 }, { text: "120 Minutes (Deep Focus)", val: 120 }] },
        { id: "drainingSubjects", title: "Which subject type drains your battery the fastest?", desc: "We will auto-schedule buffer breaks right after these classes.", options: [{ text: "STEM (Math, Physics, Coding)", val: "stem" }, { text: "Humanities (Essays, History, Reading)", val: "humanities" }, { text: "Languages / Arts", val: "languages" }] },
        { id: "procrastinationStyle", title: "How do you prefer to handle approaching deadlines?", desc: "Dictates how tasks are spread across your week.", options: [{ text: "Front-Loader (Finish early to relax)", val: "front" }, { text: "Even-Spacer (Balanced micro-doses)", val: "even" }, { text: "Pressure Cooker (Thrive under close stress)", val: "pressure" }] },
        { id: "escapeHatch", title: "What is your go-to study style?", desc: "Used to format your task names.", options: [{ text: "Organizing notes & folders", val: "Notes" }, { text: "Reviewing flashcards", val: "Flashcards" }, { text: "Watching video summaries", val: "Video Summary" }] },
        { id: "noGoZone", title: "Preferred rest window?", desc: "Keeps specific days/times clear.", options: [{ text: "Weekend Mornings Off", val: "weekend-morning" }, { text: "Keep Evenings Clear", val: "evenings" }] },
        { id: "bufferPreference", title: "Study spacing style?", desc: "Controls break spacing.", options: [{ text: "Power Through", val: "none" }, { text: "Breather Mode", val: "break" }] }
    ];

    const q = window.onboardingQuestions[window.currentOnboardingStep];    
    
    if (indicator) indicator.textContent = `Question ${window.currentOnboardingStep + 1} of 8`;
    if (bar) bar.style.width = `${((window.currentOnboardingStep + 1) / 8) * 100}%`;
    if (backBtn) backBtn.style.visibility = window.currentOnboardingStep === 0 ? "hidden" : "visible";
    if (nextBtn) nextBtn.textContent = window.currentOnboardingStep === 7 ? "Finish & Launch 🚀" : "Next Step ▶";

    let html = `
        <h3 style="color: #f8fafc; font-size: 1.2rem; font-weight: 600; margin-bottom: 6px;">${q.title}</h3>
        <p style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 20px;">${q.desc}</p>
    `;

    if (q.isTextInput) {
        html += `
            <textarea id="onboarding-text-input" placeholder="${q.placeholder}" 
                style="width: 100%; height: 100px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #f8fafc; padding: 12px; font-size: 0.9rem; outline: none; resize: none;"></textarea>
        `;
        qBox.innerHTML = html;
        
        const textInput = document.getElementById("onboarding-text-input");
        textInput.value = window.onboardingAnswers[q.id] || "";
        textInput.addEventListener("input", () => {
            window.onboardingAnswers[q.id] = textInput.value.trim();
        });
        return;
    }

    html += `<div style="display: flex; flex-direction: column; gap: 10px;">`;

    q.options.forEach(opt => {
        const isSelected = window.onboardingAnswers[q.id] === opt.val;
        const borderStyle = isSelected ? "border-color: #38bdf8; background: #0f172a;" : "border-color: #334155; background: transparent;";
        const textStyle = isSelected ? "color: #38bdf8;" : "color: #e2e8f0;";

        html += `
            <div class="onboarding-opt-row" data-val="${opt.val}" style="border: 2px solid; ${borderStyle} padding: 14px 18px; border-radius: 8px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center;">
                <span style="font-size: 0.9rem; font-weight: 600; ${textStyle}">${opt.text}</span>
            </div>
        `;
    });

    html += `</div>`;
    qBox.innerHTML = html;

    qBox.querySelectorAll(".onboarding-opt-row").forEach(row => {
        row.addEventListener("click", (e) => {
            e.stopPropagation();
            
            // FIX: Using e.currentTarget guarantees it grabs the row container 
            // even if you click directly on the text span inside it!
            const currentTargetRow = e.currentTarget;
            const selectedVal = currentTargetRow.getAttribute("data-val");
            const parsedVal = isNaN(selectedVal) ? selectedVal : parseInt(selectedVal);
            
            window.onboardingAnswers[q.id] = parsedVal;
            
            // Clear highlights from all rows
            qBox.querySelectorAll(".onboarding-opt-row").forEach(r => {
                r.style.borderColor = "#334155";
                r.style.background = "transparent";
                const txt = r.querySelector("span");
                if (txt) txt.style.color = "#e2e8f0";
            });
            
            // Highlight the clicked row container safely
            currentTargetRow.style.borderColor = "#38bdf8";
            currentTargetRow.style.background = "#0f172a";
            const currentTxt = currentTargetRow.querySelector("span");
            if (currentTxt) currentTxt.style.color = "#38bdf8";
        });
    });
}

// 10. INITIALIZATION
updateCalendarHeaderLabels();
renderTasks();

// CONNECT CORE UI LISTENERS
if (sendButton) sendButton.addEventListener('click', handleSendMessage);
if (chatInput) {
    chatInput.addEventListener('keydown', (e) => { 
        if (e.key === 'Enter') handleSendMessage(); 
    });
}

// INITIALIZE ONBOARDING NAVIGATION INTERCEPT
const onboardModal = document.getElementById("onboarding-modal");
const onboardNext = document.getElementById("onboarding-next-btn");
const onboardBack = document.getElementById("onboarding-back-btn");

// Check if the user already has a saved profile on startup!
const savedProfile = localStorage.getItem("userPersonalityProfile");
if (savedProfile && onboardModal) {
    onboardModal.style.display = "none";
}

if (onboardNext && onboardBack && onboardModal) {
    onboardNext.addEventListener("click", () => {
        // Change this line to use window.onboardingQuestions
        const currentQ = window.onboardingQuestions[window.currentOnboardingStep];
        
        // FIX: Change onboardingAnswers to window.onboardingAnswers
        if (window.onboardingAnswers[currentQ.id] === undefined) {
            alert("Please pick an option to customize your baseline schedule setting!");
            return;
        }

        // FIX: Change currentOnboardingStep to window.currentOnboardingStep
        if (window.currentOnboardingStep < 7) {
            window.currentOnboardingStep++;
            renderOnboardingStep();
        } else {
            // FIX: Change onboardingAnswers to window.onboardingAnswers
            localStorage.setItem("userPersonalityProfile", JSON.stringify(window.onboardingAnswers));
            onboardModal.style.display = "none";
            
            if (typeof chatMessages !== 'undefined' && chatMessages) {
                const welcomeMsg = document.createElement('div');
                welcomeMsg.classList.add('message', 'ai-message');
                welcomeMsg.textContent = "🎯 Profile locked down completely! Your learning style settings are now fully integrated. Talk to me naturally, and I will tailor your calendar bubbles to match your energy levels perfectly!";
                chatMessages.appendChild(welcomeMsg);
            }
        }
    });

    onboardBack.addEventListener("click", () => {
        // FIX: Change currentOnboardingStep to window.currentOnboardingStep
        if (window.currentOnboardingStep > 0) {
            window.currentOnboardingStep--;
            renderOnboardingStep();
        }
    });
}

renderOnboardingStep();

function handleAddTask(date, time, duration, intensity, title, type = 'STUDY_BLOCK') {
    console.log(`Successfully drawing task: ${title} on ${date} at ${time} [Type: ${type}]`);

    if (typeof calendarTasks !== 'undefined') {
        // --- DUPLICATION SHIELD CHECK ---
        const isDuplicate = calendarTasks.some(t => 
            t.dateStr === date && 
            t.timeSlot === time && 
            t.title.toLowerCase() === title.toLowerCase()
        );

        if (isDuplicate) {
            console.log(`⚠️ Prevented duplicate item entry: ${title}`);
            return; 
        }

        const newTask = {
            dateStr: date,
            timeSlot: time,
            duration: parseInt(duration) || 30,
            energy: intensity.charAt(0).toUpperCase() + intensity.slice(1).toLowerCase(),
            title: title,
            type: (type || 'STUDY_BLOCK').toUpperCase(), // Store item type
            notes: "Automatically generated study block",
            resources: []
        };
        
        calendarTasks.push(newTask);
        
        if (typeof saveAndRefresh === 'function') {
            saveAndRefresh();
        } else if (typeof renderTasks === 'function') {
            localStorage.setItem('calendarTasks', JSON.stringify(calendarTasks));
            renderTasks();
        }
    }
}