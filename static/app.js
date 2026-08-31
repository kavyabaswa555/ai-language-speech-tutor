const textInput =
    document.getElementById("textInput");

const textButton =
    document.getElementById("textButton");

const recordButton =
    document.getElementById("recordButton");

const voiceButton =
    document.getElementById("voiceButton");

const status =
    document.getElementById("recordStatus");

const recorded =
    document.getElementById("recordedAudio");

const results =
    document.getElementById("results");

const transcript =
    document.getElementById("transcript");

const answer =
    document.getElementById("answer");

const responseAudio =
    document.getElementById("responseAudio");

const download =
    document.getElementById("downloadLink");

const error =
    document.getElementById("error");


let recorder = null;
let chunks = [];
let blob = null;


function showError(message) {

    error.textContent = message;

}


function clearError() {

    error.textContent = "";

}


function showResult(data) {

    results.hidden = false;

    transcript.textContent =
        data.transcript || "";

    answer.textContent =
        data.answer || "";

    responseAudio.src =
        data.audio_url;

    download.href =
        data.audio_url;

    responseAudio.load();

}


async function getErrorMessage(response) {

    const contentType =
        response.headers.get("content-type") || "";

    if (
        contentType.includes("application/json")
    ) {

        const data =
            await response.json();

        return (
            data.detail ||
            "Request failed."
        );
    }

    const text =
        await response.text();

    return (
        text ||
        "Server returned an error."
    );
}


// =========================
// Text request
// =========================

textButton.onclick = async () => {

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

        if (!response.ok) {

            throw new Error(
                await getErrorMessage(response)
            );

        }

        const data =
            await response.json();

        showResult(data);

    }
    catch (e) {

        showError(
            e.message
        );

    }
    finally {

        textButton.disabled = false;

        textButton.textContent =
            "Generate Voice Response";

    }

};


// =========================
// Recording
// =========================

recordButton.onclick = async () => {

    clearError();


    // Stop recording
    if (
        recorder &&
        recorder.state !== "inactive"
    ) {

        recorder.stop();

        recordButton.textContent =
            "🎤 Start Recording";

        status.textContent =
            "Recording ready.";

        return;
    }


    try {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "Your browser does not support microphone access."
            );

        }


        const stream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true
                });


        chunks = [];

        recorder =
            new MediaRecorder(
                stream
            );


        recorder.ondataavailable =
            (event) => {

                if (
                    event.data &&
                    event.data.size > 0
                ) {

                    chunks.push(
                        event.data
                    );

                }

            };


        recorder.onstop = () => {

            blob = new Blob(
                chunks,
                {
                    type: "audio/webm"
                }
            );


            recorded.src =
                URL.createObjectURL(blob);

            recorded.hidden = false;

            voiceButton.disabled =
                false;


            stream
                .getTracks()
                .forEach(
                    track => track.stop()
                );

        };


        recorder.start();

        recordButton.textContent =
            "⏹ Stop Recording";

        status.textContent =
            "Recording...";


    }
    catch (e) {

        showError(
            "Microphone access was not available. " +
            "Please allow microphone permission."
        );

    }

};


// =========================
// Voice request
// =========================

voiceButton.onclick = async () => {

    clearError();


    if (!blob) {

        showError(
            "Record a question first."
        );

        return;
    }


    voiceButton.disabled = true;

    voiceButton.textContent =
        "Processing...";


    try {

        const formData =
            new FormData();


        formData.append(
            "audio",
            blob,
            "question.webm"
        );


        const response =
            await fetch(
                "/api/voice",
                {
                    method: "POST",
                    body: formData
                }
            );


        if (!response.ok) {

            throw new Error(
                await getErrorMessage(response)
            );

        }


        const data =
            await response.json();


        showResult(data);


    }
    catch (e) {

        showError(
            e.message
        );

    }
    finally {

        voiceButton.disabled = false;

        voiceButton.textContent =
            "Send Voice Question";

    }

};