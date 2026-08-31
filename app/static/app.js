
// ============================================================
// LLM MEET SPEECH ASSISTANT
// ============================================================

const textInput = document.getElementById("textInput");
const textButton = document.getElementById("textButton");

const recordButton = document.getElementById("recordButton");
const recordStatus = document.getElementById("recordStatus");
const recordedAudio = document.getElementById("recordedAudio");

const voiceButton = document.getElementById("voiceButton");

const results = document.getElementById("results");
const transcript = document.getElementById("transcript");
const answer = document.getElementById("answer");

const responseAudio = document.getElementById("responseAudio");
const downloadLink = document.getElementById("downloadLink");

const errorBox = document.getElementById("error");


let recorder = null;
let chunks = [];
let audioBlob = null;
let stream = null;


// ============================================================
// ERROR
// ============================================================

function showError(message) {

    console.error(message);

    errorBox.textContent = String(message);
    errorBox.style.display = "block";
}


function clearError() {

    errorBox.textContent = "";
    errorBox.style.display = "none";
}


// ============================================================
// SERVER RESULT
// ============================================================

function showResult(data) {

    console.log("SERVER RESULT:", data);

    if (!data) {

        showError("Empty server response.");

        return;
    }


    if (data.success === false) {

        showError(
            data.error ||
            data.detail ||
            "Request failed."
        );

        return;
    }


    results.hidden = false;


    transcript.textContent =
        data.transcript || "";


    answer.textContent =
        data.answer || "";


    if (
        data.audio_url &&
        typeof data.audio_url === "string"
    ) {

        console.log(
            "AUDIO URL:",
            data.audio_url
        );

        responseAudio.hidden = false;

        responseAudio.src =
            data.audio_url;

        responseAudio.load();


        downloadLink.hidden = false;

        downloadLink.href =
            data.audio_url;

    }
}


// ============================================================
// JSON
// ============================================================

async function readJSON(response) {

    const contentType =
        response.headers.get(
            "content-type"
        ) || "";


    if (
        !contentType.includes(
            "application/json"
        )
    ) {

        const text =
            await response.text();

        throw new Error(
            text ||
            "Server returned an invalid response."
        );
    }


    return await response.json();
}


// ============================================================
// TEXT
// ============================================================

textButton.addEventListener(
    "click",
    async () => {

        clearError();

        const text =
            textInput.value.trim();


        if (!text) {

            showError(
                "Please enter a question."
            );

            return;
        }


        textButton.disabled = true;

        textButton.textContent =
            "Generating...";


        try {

            const response =
                await fetch(
                    "/api/text",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            text: text
                        })
                    }
                );


            const data =
                await readJSON(response);


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    data.detail ||
                    "Text request failed."
                );
            }


            showResult(data);

        }
        catch (error) {

            console.error(
                "TEXT ERROR:",
                error
            );

            showError(
                error.message
            );

        }
        finally {

            textButton.disabled = false;

            textButton.textContent =
                "Generate Voice Response";
        }
    }
);


// ============================================================
// RECORD
// ============================================================

recordButton.addEventListener(
    "click",
    async () => {

        clearError();


        // ----------------------------------------------------
        // STOP
        // ----------------------------------------------------

        if (
            recorder &&
            recorder.state === "recording"
        ) {

            recorder.stop();

            recordButton.textContent =
                "🎤 Start Recording";

            recordStatus.textContent =
                "Processing recording...";

            return;
        }


        // ----------------------------------------------------
        // MICROPHONE
        // ----------------------------------------------------

        try {

            stream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true
                    });


            chunks = [];
            audioBlob = null;


            // ------------------------------------------------
            // MIME TYPE
            // ------------------------------------------------

            let mimeType =
                "audio/webm";


            if (
                MediaRecorder.isTypeSupported(
                    "audio/webm;codecs=opus"
                )
            ) {

                mimeType =
                    "audio/webm;codecs=opus";

            }
            else if (
                MediaRecorder.isTypeSupported(
                    "audio/webm"
                )
            ) {

                mimeType =
                    "audio/webm";

            }
            else if (
                MediaRecorder.isTypeSupported(
                    "audio/ogg;codecs=opus"
                )
            ) {

                mimeType =
                    "audio/ogg;codecs=opus";
            }


            // ------------------------------------------------
            // RECORDER
            // ------------------------------------------------

            recorder =
                new MediaRecorder(
                    stream,
                    {
                        mimeType: mimeType
                    }
                );


            console.log(
                "RECORDER TYPE:",
                recorder.mimeType
            );


            // ------------------------------------------------
            // DATA
            // ------------------------------------------------

            recorder.ondataavailable =
                event => {

                    if (
                        event.data &&
                        event.data.size > 0
                    ) {

                        chunks.push(
                            event.data
                        );
                    }
                };


            // ------------------------------------------------
            // STOP EVENT
            // ------------------------------------------------

            recorder.onstop =
                () => {

                    const finalType =
                        recorder.mimeType ||
                        "audio/webm";


                    audioBlob =
                        new Blob(
                            chunks,
                            {
                                type: finalType
                            }
                        );


                    console.log(
                        "AUDIO BLOB:",
                        audioBlob
                    );

                    console.log(
                        "SIZE:",
                        audioBlob.size
                    );


                    if (
                        audioBlob.size === 0
                    ) {

                        showError(
                            "Recording is empty."
                        );

                        return;
                    }


                    const url =
                        URL.createObjectURL(
                            audioBlob
                        );


                    recordedAudio.src =
                        url;

                    recordedAudio.hidden =
                        false;


                    voiceButton.disabled =
                        false;


                    recordStatus.textContent =
                        "Recording ready. Click Send Voice Question.";


                    if (stream) {

                        stream
                            .getTracks()
                            .forEach(
                                track =>
                                    track.stop()
                            );

                        stream = null;
                    }
                };


            // ------------------------------------------------
            // START
            // ------------------------------------------------

            recorder.start();


            recordButton.textContent =
                "⏹ Stop Recording";


            recordStatus.textContent =
                "🔴 Recording... Speak now.";


            voiceButton.disabled =
                true;

        }
        catch (error) {

            console.error(
                "MIC ERROR:",
                error
            );

            showError(
                "Microphone permission is required."
            );
        }
    }
);


// ============================================================
// SEND VOICE
// ============================================================

voiceButton.addEventListener(
    "click",
    async () => {

        clearError();


        if (!audioBlob) {

            showError(
                "Please record something first."
            );

            return;
        }


        if (audioBlob.size === 0) {

            showError(
                "Recording is empty."
            );

            return;
        }


        voiceButton.disabled = true;

        voiceButton.textContent =
            "Processing...";


        recordStatus.textContent =
            "Uploading audio...";


        try {

            // ------------------------------------------------
            // DETERMINE EXTENSION
            // ------------------------------------------------

            let extension =
                ".webm";


            if (
                audioBlob.type.includes(
                    "ogg"
                )
            ) {

                extension =
                    ".ogg";
            }


            // ------------------------------------------------
            // CREATE REAL FILE
            // ------------------------------------------------

            const file =
                new File(
                    [audioBlob],
                    "question" + extension,
                    {
                        type:
                            audioBlob.type ||
                            "audio/webm"
                    }
                );


            console.log(
                "FILE BEING SENT:"
            );

            console.log(
                "name:",
                file.name
            );

            console.log(
                "type:",
                file.type
            );

            console.log(
                "size:",
                file.size
            );


            // ------------------------------------------------
            // FORMDATA
            // ------------------------------------------------

            const formData =
                new FormData();


            formData.append(
                "file",
                file
            );


            // ------------------------------------------------
            // VERIFY
            // ------------------------------------------------

            console.log(
                "FormData has file:",
                formData.has("file")
            );


            for (
                const [key, value]
                of formData.entries()
            ) {

                console.log(
                    "FORM DATA:",
                    key,
                    value
                );
            }


            // ------------------------------------------------
            // SEND
            // ------------------------------------------------

            const response =
                await fetch(
                    "/api/voice",
                    {
                        method: "POST",

                        body: formData
                    }
                );


            console.log(
                "VOICE STATUS:",
                response.status
            );


            const data =
                await readJSON(response);


            console.log(
                "VOICE RESULT:",
                data
            );


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    data.detail ||
                    "Voice request failed."
                );
            }


            showResult(data);


            recordStatus.textContent =
                "✅ Voice processed successfully.";

        }
        catch (error) {

            console.error(
                "VOICE ERROR:",
                error
            );

            showError(
                error.message ||
                "Voice processing failed."
            );

            recordStatus.textContent =
                "Voice processing failed.";

        }
        finally {

            voiceButton.disabled =
                false;

            voiceButton.textContent =
                "Send Voice Question";
        }
    }
);
