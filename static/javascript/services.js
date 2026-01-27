import { API_ENDPOINTS, CONFIG, ELEMENTS } from './constants.js';

export const AppState = (() => {
    const state = {
        data: {
            currentId: 0,
            inputData: null,
            imageData: null,
            responseData: null,
            mainContent: null,
            modelName: null
        },
        ui: {
            typingInProgress: false,
            currentTab: 'main',
            activePopup: null
        },
        model: {
            lastStatus: null,
            statusChecking: false
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
        state.data.imageData = null;
        state.data.responseData = null;
    }

    function getPatient() {
        return {
            get image() {
                return state.data.imageData[state.data.currentId];
            },
            get pID() {
                return state.data.inputData[state.data.currentId].name.substring(0, state.data.inputData[state.data.currentId].name.lastIndexOf("."));
            },
            get gradCAM() {
                return state.data.responseData[state.data.currentId].images.gradcam;
            },
            get prediction() {
                return state.data.responseData[state.data.currentId].predictions[0];
            },
            get confidence() {
                const conf = this.predClass === 1 ? this.prediction : (1 - this.prediction);
                return (conf * 100).toFixed(1) + "%";
            },
            get predClass() {
                return state.data.responseData[state.data.currentId].predictions[1];
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
        if (!res.ok) throw new Error(`Prediction failed: ${res.status}`);
        return await res.json();
    }

    async function checkModelStatus() {
        const res = await fetch(API_ENDPOINTS.MODEL_STATUS);
        if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
        return await res.json();
    }

    async function reloadModel(formData) {
        const res = await fetch(API_ENDPOINTS.MODEL_RELOAD, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error(`Model reload failed: ${res.status}`);
        return await res.json();
    }

    async function loadDatabase() {
        const res = await fetch(API_ENDPOINTS.LOAD_DATABASE);
        if (!res.ok) throw new Error(`Database load failed: ${res.status}`);
        return await res.json();
    }

    async function saveToDatabase(payload) {
        const res = await fetch(API_ENDPOINTS.SAVE_TO_DATABASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
        return await res.json();
    }

    async function deleteFromDatabase(id) {
        const res = await fetch(API_ENDPOINTS.DELETE_FROM_DATABASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
        return await res.json();
    }

    return {
        predict,
        checkModelStatus,
        reloadModel,
        loadDatabase,
        saveToDatabase,
        deleteFromDatabase
    };
})();

export const ModelStatusChecker = (() => {
    async function check() {
        const state = AppState.getState();
        if (state.model.statusChecking) return;

        AppState.updateModel({ statusChecking: true });
        
        try {
            const data = await APIService.checkModelStatus();
            AppState.updateData({ modelName: data.name });
            
            if (data.status !== state.model.lastStatus) {
                // Import DOMHelpers dynamically to avoid circular dependency
                const { DOMHelpers } = await import('./utils.js');

                if (data.status) {
                    DOMHelpers.disableElement(ELEMENTS.FILE_INPUT, false);
                    DOMHelpers.disableElement(ELEMENTS.DROP_AREA, false);
                    DOMHelpers.showNotification('Model is ready!', 'Success');
                    AppState.updateModel({ lastStatus: true });
                } else {
                    const message = data.error ? 'Model reloading process failed' : 'Model is reloading...';
                    const type = data.error ? 'Error' : 'Info';
                    DOMHelpers.showNotification(message, type);
                    AppState.updateModel({ lastStatus: data.error ? null : false });
                }
            }

            if (!data.status && !data.error) {
                setTimeout(check, CONFIG.MODEL_STATUS_CHECK_INTERVAL);
            }
        } catch (error) {
            const { DOMHelpers } = await import('./utils.js');
            DOMHelpers.showNotification('Unable to check model status', 'Error');
            console.error('Model status check error:', error);
        } finally {
            AppState.updateModel({ statusChecking: false });
        }
    }

    return { check };
})();