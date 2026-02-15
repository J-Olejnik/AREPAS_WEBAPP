import { API_ENDPOINTS, ELEMENTS } from './constants.js';

export const AppState = (() => {
    const state = {
        data: {
            currentId: 0,
            inputData: null,
            responseData: null,
            mainContent: null,
            modelName: 'Undefined',
            modelLoaded: false
        },
        ui: {
            typingInProgress: false,
            predictionInProgress: false,
            currentTab: 'main',
            activePopup: null,
            typingTimeout: null
        }
    };

    function getState() {
        return state;
    }

    function updateData(updates) {
        Object.assign(state.data, updates);
    }

    function updateUI(updates) {
        Object.assign(state.ui, updates);
    }

    function updateModel(updates) {
        Object.assign(state.model, updates);
    }

    function resetImageData() {
        state.data.currentId = 0;
        state.data.responseData = null;
    }

    function getPatient() {
        return {
            get image() {
                return state.data.inputData[state.data.currentId].image;
            },
            get pID() {
                return state.data.inputData[state.data.currentId].name.substring(0, state.data.inputData[state.data.currentId].name.lastIndexOf("."));
            },
            get gradCAM() {
                return state.data.responseData.results[state.data.currentId].images.gradcam;
            },
            get prediction() {
                return state.data.responseData.results[state.data.currentId].predictions[0];
            },
            get confidence() {
                const conf = this.predClass === 1 ? this.prediction : (1 - this.prediction);
                return (conf * 100).toFixed(1) + "%";
            },
            get predClass() {
                return state.data.responseData.results[state.data.currentId].predictions[1];
            }
        };
    }

    return {
        getState,
        updateData,
        updateUI,
        updateModel,
        resetImageData,
        getPatient
    };
})();

export const APIService = (() => {
    async function predict(formData) {
        const res = await fetch(API_ENDPOINTS.PREDICT, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (!res.ok) {
            const error = new Error(`Prediction failed: ${res.status} | ${data.error}`);
            error.res = data.error;
            throw error;
        }
        return data;
    }

    async function reloadModel(formData) {
        const res = await fetch(API_ENDPOINTS.MODEL_RELOAD, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (!res.ok) {
            const error = new Error(`Model reload failed: ${res.status} | ${data.error}`);
            error.res = data.error;
            throw error;
        }
        return data;
    }

    async function loadDatabase() {
        const res = await fetch(API_ENDPOINTS.LOAD_DATABASE);
        const data = await res.json();
        if (!res.ok) {
            const error = new Error(`Database load failed: ${res.status} | ${data.error}`);
            error.res = data.error;
            throw error;
        }
        return data;
    }

    async function saveToDatabase(payload) {
        const res = await fetch(API_ENDPOINTS.SAVE_TO_DATABASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
            const error = new Error(`Save failed: ${res.status} | ${data.error}`);
            error.res = data.error;
            throw error;
        }
        return data;
    }

    async function deleteFromDatabase(id) {
        const res = await fetch(API_ENDPOINTS.DELETE_FROM_DATABASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (!res.ok) {
            const error = new Error(`Delete failed: ${res.status} | ${data.error}`);
            error.res = data.error;
            throw error;
        }
        return data;
    }

    async function logError(error) {
        const res = await fetch(API_ENDPOINTS.LOG_ERROR, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({error_msg:`${error.stack}`})
        });
        const data = await res.json();
        if (!res.ok) {
            const error = new Error(`Logging failed: ${res.status} | ${data.error}`);
            error.res = data.error;
            throw error;
        }
        return data;
    }

    return {
        predict,
        reloadModel,
        loadDatabase,
        saveToDatabase,
        deleteFromDatabase,
        logError
    };
})();

export const SocketService = (() => {
    let socket = null;

    function init() {
        socket = io({
            transports: ['websocket'],
            upgrade: false
        });

        // Listen for backend notifications
        socket.on('notification', async (data) => {
            const { DOMHelpers } = await import('./utils.js');

            if (data.message) DOMHelpers.showNotification(data.message, data.type);

            if ("status" in data) {
                AppState.updateData({ modelLoaded: data.status });
                
                if (data.status) {
                    if (data.name !== undefined) {
                        AppState.updateData({ modelName: data.name });

                        const popup = document.getElementById(ELEMENTS.SETTINGS_POPUP);

                        if (popup) {
                            popup.querySelector('[data-field]').textContent = data.name;
                        }
                    }
                    DOMHelpers.disableElement(ELEMENTS.FILE_INPUT, false);
                    DOMHelpers.disableElement(ELEMENTS.DROP_AREA, false);
                }
            }
        });

        return socket;
    }

    return { init };
})();