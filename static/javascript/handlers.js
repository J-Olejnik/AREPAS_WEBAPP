import { ELEMENTS, TEMPLATES } from './constants.js';
import { AppState, APIService } from './services.js';
import { DOMHelpers } from './utils.js';

export const ImageHandler = (() => {
    async function handleFiles(files) {

        AppState.resetImageData();
        
        if (DOMHelpers.checkExisting(ELEMENTS.IMG_BTNS)) {
            DOMHelpers.disableElement(ELEMENTS.PREV_BTN, true);
            DOMHelpers.disableElement(ELEMENTS.NEXT_BTN, true);
            DOMHelpers.disableElement(ELEMENTS.SAVE_BTN, true);
            DOMHelpers.disableElement(ELEMENTS.DOWNLOAD_BTN, true);
        }

        const formData = new FormData();
        const newImageData = [];

        files.forEach((file, index) => {
            formData.append('files', file);

            const reader = new FileReader();
            reader.onload = () => {
                newImageData[index] = reader.result;
                if (index === 0) {
                    DOMHelpers.displayImage(
                        document.getElementById(ELEMENTS.DROP_AREA),
                        newImageData[0]
                    );
                }
            };
            reader.readAsDataURL(file);
        });

        AppState.updateData({ imageData: newImageData });
        
        // Update UI
        const patient = AppState.getPatient();
        const imgInfo = document.getElementById(ELEMENTS.IMG_INFO);
        Object.assign(imgInfo.style, {
            height: '30px',
            marginBottom: '5px',
            fontSize: '1.5em',
            fontWeight: '600'
        });

        document.getElementById(ELEMENTS.INN_IMG_CONTAINER).style.setProperty('--height', '85%');
        imgInfo.innerHTML = `<p id="pID">Patient ID: ${patient.pID}</p><p id="GradCAMlbl">GradCAM</p>`;

        if (!DOMHelpers.checkExisting(ELEMENTS.IMG_BTNS)) {
            const template = document.getElementById(TEMPLATES.IMG_BTN).content.cloneNode(true);
            document.getElementById(ELEMENTS.BTN_CONTAINER).appendChild(template);
        }

        // Process images
        DOMHelpers.showLoadingAnimation();
        DOMHelpers.typeText('Processing...');

        try {
            const responseData = await APIService.predict(formData);
            AppState.updateData({ responseData });
            
            // Check if still on main tab after response and render data accordingly
            const currentState = AppState.getState();
            (currentState.ui.currentTab === 'main' ? displayResults : renderInBackground)(patient, files.length);

        } catch (error) {
            if (AppState.getState().ui.currentTab === 'main') {
                DOMHelpers.typeText(`<strong>Error:</strong> ${error.message}`);
            }
            DOMHelpers.showNotification('Prediction failed', 'error');
            console.error('Prediction error:', error);
        }
    }

    function renderInBackground(patient, fileCount) {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = AppState.getState().data.mainContent;
        
        // Must be querySelector since query within a specific object
        const gradCAMBox = tempContainer.querySelector('#' + ELEMENTS.GRADCAM_BOX);
        if (gradCAMBox) {
            gradCAMBox.innerHTML = '';
            const img = new Image();
            img.src = patient.gradCAM;
            Object.assign(img.style, {
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '10px'
            });
            gradCAMBox.style.border = '2px solid #ccc';
            gradCAMBox.appendChild(img);
        }
        
        const textBox = tempContainer.querySelector('#' + ELEMENTS.TEXT_BOX);
        if (textBox) {
            textBox.innerHTML = `
                <p><strong>Raw prediction:</strong> ${patient.prediction}</p>
                <p><strong>Predicted class:</strong> ${patient.predClass}</p>
                <p><strong>Confidence:</strong> ${patient.confidence}</p>
            `;
        }
        
        const saveBtn = tempContainer.querySelector('#' + ELEMENTS.SAVE_BTN);
        const downloadBtn = tempContainer.querySelector('#' + ELEMENTS.DOWNLOAD_BTN);
        const nextBtn = tempContainer.querySelector('#' + ELEMENTS.NEXT_BTN);
        
        if (saveBtn) saveBtn.disabled = false;
        if (downloadBtn) downloadBtn.disabled = false;
        if (nextBtn && fileCount > 1) nextBtn.disabled = false;
        
        // Save updated HTML back to mainContent
        AppState.updateData({ mainContent: tempContainer.innerHTML });
    }

    function displayResults(patient, fileCount) {
        DOMHelpers.disableElement(ELEMENTS.SAVE_BTN, false);
        DOMHelpers.disableElement(ELEMENTS.DOWNLOAD_BTN, false);
        DOMHelpers.displayImage(
            document.getElementById(ELEMENTS.GRADCAM_BOX),
            patient.gradCAM
        );

        if (fileCount > 1) {
            DOMHelpers.disableElement(ELEMENTS.NEXT_BTN, false);
        }

        DOMHelpers.typeText(
            `<p><strong>Raw prediction:</strong> ${patient.prediction}</p>
            <p><strong>Predicted class:</strong> ${patient.predClass}</p>
            <p><strong>Confidence:</strong> ${patient.confidence}</p>`,
            true
        );
    }

    return { handleFiles };
})();


export const NavigationHandler = (() => {
    function navigatePrevious() {
        const state = AppState.getState();
        if (state.data.currentId > 0) {
            AppState.updateData({ currentId: state.data.currentId - 1 });
            updateDisplay();
        }
    }

    function navigateNext() {
        const state = AppState.getState();
        if (state.data.currentId < state.data.inputData.length - 1) {
            AppState.updateData({ currentId: state.data.currentId + 1 });
            updateDisplay();
        }
    }

    function updateDisplay() {
        const state = AppState.getState();
        const patient = AppState.getPatient();
        
        document.getElementById(ELEMENTS.PATIENT_ID).innerHTML = `Patient ID: ${patient.pID}`;
        DOMHelpers.displayImage(document.getElementById(ELEMENTS.DROP_AREA), patient.image);
        DOMHelpers.displayImage(document.getElementById(ELEMENTS.GRADCAM_BOX), patient.gradCAM);
        
        document.getElementById(ELEMENTS.TEXT_BOX).innerHTML = `
            <p><strong>Raw prediction:</strong> ${patient.prediction}</p>
            <p><strong>Predicted class:</strong> ${patient.predClass}</p>
            <p><strong>Confidence:</strong> ${patient.confidence}</p>
        `;

        // Update button states
        DOMHelpers.disableElement(ELEMENTS.PREV_BTN, state.data.currentId === 0);
        DOMHelpers.disableElement(ELEMENTS.NEXT_BTN, state.data.currentId === state.data.inputData.length - 1);
    }

    return {
        navigatePrevious,
        navigateNext
    };
})();

export const PopupHandler = (() => {
    function openDataPopup(dbRow = null) {
        if (DOMHelpers.checkExisting(ELEMENTS.DATA_POPUP, true)) return;

        const patient = AppState.getPatient();
        const displayData = dbRow || {
            pID: patient?.pID,
            prediction: patient?.prediction,
            confidence: patient?.confidence,
            predicted_class: patient?.predClass
        };
        
        DOMHelpers.openPopup(TEMPLATES.DATA_POPUP, displayData);

        if (DOMHelpers.checkExisting(ELEMENTS.IMG_BTNS)) {
            DOMHelpers.disableElement(ELEMENTS.SAVE_BTN, true);
            DOMHelpers.disableElement(ELEMENTS.DOWNLOAD_BTN, true);
        }

        // Set button data-ids if editing existing row
        if (dbRow) {
            const saveBtn = document.getElementById(ELEMENTS.POPUP_SAVE_BTN);
            const deleteBtn = document.getElementById(ELEMENTS.POPUP_DELETE_BTN);
            if (saveBtn) saveBtn.dataset.id = dbRow.id;
            if (deleteBtn) {
                deleteBtn.dataset.id = dbRow.id;
                deleteBtn.hidden = false;
            }
        }
    }

    function closeDataPopup() {
        DOMHelpers.checkExisting(ELEMENTS.DATA_POPUP, true);
        
        const saveBtn = document.getElementById(ELEMENTS.SAVE_BTN);
        if (DOMHelpers.checkExisting(ELEMENTS.IMG_BTNS) && saveBtn.disabled) {
            DOMHelpers.disableElement(ELEMENTS.SAVE_BTN, false);
            DOMHelpers.disableElement(ELEMENTS.DOWNLOAD_BTN, false);
        }
    }

    function openSettingsPopup() {
        if (DOMHelpers.checkExisting(ELEMENTS.SETTINGS_POPUP, true)) return;

        const state = AppState.getState();
        DOMHelpers.openPopup(TEMPLATES.SETTINGS_POPUP, {
            modelName: state.data.modelName
        });

        const modelFileInput = document.getElementById(ELEMENTS.MODEL_FILE_INPUT);
        modelFileInput.addEventListener('change', async (e) => {
            const newModel = e.target.files[0];
            if (!newModel) return;

            const formData = new FormData();
            formData.append('model_data', newModel);
            formData.append('filename', newModel.name);

            try {
                await APIService.reloadModel(formData);
                const { ModelStatusChecker } = await import('./services.js');
                ModelStatusChecker.check();
                DOMHelpers.checkExisting(ELEMENTS.SETTINGS_POPUP, true);
                DOMHelpers.showNotification('Model reload initiated', 'success');
            } catch (error) {
                DOMHelpers.showNotification('Model reload failed', 'error');
                console.error('Model reload error:', error);
            }
        }, { once: true });
    }

    async function saveData(id = null) {
        try {
            const patient = AppState.getPatient();
            const payload = {
                id: id,
                pID: id ? '' : patient.pID,
                predicted_class: id ? 0 : patient.predClass,
                prediction: id ? 0 : patient.prediction,
                reviewer: document.querySelector('[data-field="reviewer"]').textContent,
                status: document.querySelector('[data-field="status"]').value,
                annotation: document.querySelector('[data-field="annotation"]').value
            };

            await APIService.saveToDatabase(payload);
            PopupHandler.closeDataPopup();
            DOMHelpers.showNotification('Data saved successfully', 'success');
            
            if (id) {
                await DatabaseHandler.load();
            }
        } catch (error) {
            DOMHelpers.showNotification('Failed to save data', 'error');
            console.error('Save error:', error);
        }
    }

    async function deleteData(id) {
        if (!confirm('Are you sure you want to delete this entry?')) return;

        try {
            await APIService.deleteFromDatabase(id);
            PopupHandler.closeDataPopup();
            DOMHelpers.showNotification('Entry deleted', 'success');
            await DatabaseHandler.load();
        } catch (error) {
            DOMHelpers.showNotification('Failed to delete entry', 'error');
            console.error('Delete error:', error);
        }
    }

    return {
        openDataPopup,
        closeDataPopup,
        openSettingsPopup,
        saveData,
        deleteData
    };
})();

export const DatabaseHandler = (() => {
    async function load() {
        try {
            const data = await APIService.loadDatabase();
            const tableBody = document.getElementById(ELEMENTS.TABLE_BODY);
            tableBody.innerHTML = "";

            data.forEach(row => {
                const conf = row.predicted_class === 1 ? row.prediction : (1 - row.prediction);
                row.confidence = (conf * 100).toFixed(1) + "%";

                const tr = document.createElement("tr");
                tr.dataset.action = "loadRowData";
                tr.dataset.rowData = JSON.stringify(row);
                tr.innerHTML = `
                    <td>${row.pID}</td>
                    <td>${row.date_of_prediction}</td>
                    <td>${row.predicted_class}</td>
                    <td>${row.confidence}</td>
                    <td>${row.reviewer}</td>
                    <td>${row.status}</td>
                    <td>${row.annotation}</td>
                `;
                tableBody.appendChild(tr);
            });

        } catch (error) {
            DOMHelpers.showNotification('Failed to load database', 'error');
            console.error('Database load error:', error);
        }
    }

    return { load };
})();

export const TemplateHandler = (() => {
    async function loadTemplates() {
        try {
            const res = await fetch('/static/html/templates.html');
            const container = document.createElement('div');
            container.innerHTML = await res.text();
            document.body.append(container);
        } catch (error) {
            console.error('Failed to load templates:', error);
            DOMHelpers.showNotification('Failed to load templates', 'error');
        }
    }

    async function setTemplate(target, targetElementId = ELEMENTS.DATA_CONTAINER) {
        const heading = document.querySelector("#heading h1");
        const element = document.getElementById(targetElementId);
        const state = AppState.getState();

        if (state.ui.currentTab === target.name) return;

        if (state.ui.typingInProgress) {
            AppState.updateUI({ typingInProgress: false });
            document.getElementById(ELEMENTS.TEXT_BOX).innerHTML = document.getElementById(ELEMENTS.TEXT_BOX).dataset.fullText;
        }

        PopupHandler.closeDataPopup();
        
        if (state.ui.currentTab === 'main') {
            AppState.updateData({ 
                mainContent: document.getElementById(ELEMENTS.DATA_CONTAINER).innerHTML 
            });
        }

        if (target.name === 'main') {
            heading.textContent = "UNILATERAL UTO CLASSIFICATION";
            element.innerHTML = state.data.mainContent;
            const { EventManager } = await import('./events.js');
            EventManager.attachMainListeners();
        } else {
            const template = document.getElementById(`${target.name}-template`).content.cloneNode(true);
            heading.textContent = target.text;
            element.replaceChildren(template);

            if (target.name === 'database') {
                await DatabaseHandler.load();
            }
        }

        AppState.updateUI({ currentTab: target.name });
    }

    return {
        loadTemplates,
        setTemplate
    };
})();