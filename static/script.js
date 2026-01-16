const menuItems = [
    { text: 'Home', name: 'main'},
    { text: 'Instructions', name: 'instructions'},
    { text: 'Database', name: 'database'},
    { text: 'About', name: 'about'},
    { text: 'Settings', name: 'settings'}
];

const actions = {
    // Text typing
    typingInProgress: false,

    // Buttons
    imageBtnsExist: false,

    // Model reload
    lastStatus: null,
    modelStatusChecking: false,

    // Current tab
    currentTab: menuItems[0].name
};

const data = {
    currentId: 0,
    inputData: null,
    imageData: null,
    responseData: null,
    mainContent: document.getElementById('dataContainer').innerHTML,
    modelName: null,

    resetState() {
        this.currentId = 0;
        this.imageData = null;
        this.responseData = null;
    }
}

const patient = {
    get image() {
        return data.imageData[data.currentId];
    },

    get pID() {
        return data.inputData[data.currentId].name.substring(0, data.inputData[data.currentId].name.lastIndexOf("."));
    },

    get gradCAM() {
        return data.responseData[data.currentId].images.gradcam;
    },

    get prediction() {
        return data.responseData[data.currentId].predictions[0];
    },

    get confidence() {
        const conf = this.predClass === 1 ? this.prediction : (1 - this.prediction);
        return (conf * 100).toFixed(1) + "%";
    },

    get predClass() {
        return data.responseData[data.currentId].predictions[1];
    },

    toJSON() {
        return {
            pID: this.pID,
            prediction: this.prediction,
            confidence: this.confidence,
            predicted_class: this.predClass
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const menuCheckbox = menuBtn.querySelector('input');

    menuBtn.addEventListener('click', (event) => {
        event.preventDefault();
        menuCheckbox.checked = !menuCheckbox.checked;
        
        const isExpanding = menu.style.width !== '200px';
        menu.style.width = isExpanding ? '200px' : '60px';

        if (isExpanding) {
            setTimeout(() => { // Delay for looks
                const menuContainer = document.createElement('div');
                menuContainer.classList.add('menuItemsContainer');
                
                // All except settings
                menuItems.slice(0, -1).forEach(item => {
                    const menuItemEl = document.createElement('div');
                    menuItemEl.id = item.text.toLowerCase() + 'Btn';
                    menuItemEl.classList.add('menuItem');
        
                    const textEl = document.createElement('span');
                    textEl.textContent = item.text;
        
                    menuItemEl.appendChild(textEl);
                    menuItemEl.addEventListener('mouseover', () => menuItemEl.classList.add('hover'));
                    menuItemEl.addEventListener('mouseout', () => menuItemEl.classList.remove('hover'));
                    menuItemEl.addEventListener('click', () => setTemplate(item));
        
                    menuContainer.appendChild(menuItemEl);
                });
        
                menu.appendChild(menuContainer);

                const textEl = document.createElement('span');
                textEl.textContent = menuItems.at(-1).text;
                settingsBtn.appendChild(textEl);
                settingsBtn.addEventListener('mouseover', () => settingsBtn.classList.add('hover'));
                settingsBtn.addEventListener('mouseout', () => settingsBtn.classList.remove('hover'));

            }, 300);
        } else {
            const container = menu.querySelector('.menuItemsContainer');
            container && menu.removeChild(container);

            // Settings button
            settingsBtn.removeChild(settingsBtn.querySelector('span'));
            const newBtn = settingsBtn.cloneNode(true); // delete listeners (hover)
            settingsBtn.parentNode.replaceChild(newBtn, settingsBtn);
            settingsBtn.addEventListener('click', () => controlClick(settingsBtn.id));
        }
    });

    settingsBtn.addEventListener('click', () => controlClick(settingsBtn.id));

    // Save main content if user changes page
    data.mainContent = document.getElementById('dataContainer').innerHTML;

    // Methods to run once the main page loads
    establishMainListeners();
    checkModelStatus();
    loadTemplates();
});

function establishMainListeners() {
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropArea.classList.add('hover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropArea.classList.remove('hover');
        }, false);
    });

    const handleFileSource = fileList => {
        const files = [...fileList].filter(f => f.type.startsWith('image/'));
        if (!files.length) return;
        data.inputData = files;
        handleImages(files);
    };

    dropArea.addEventListener('drop', e =>
        handleFileSource(e.dataTransfer.files)
    );

    fileInput.addEventListener('change', e =>
        handleFileSource(e.target.files)
    );
}

async function loadTemplates() {
    const res = await fetch('/static/templates.html');
    const container = document.createElement('div');

    container.innerHTML = await res.text();
    document.body.append(container);
}

function controlClick(id, dbRow=null) {

    switch(id) {
        case 'prevBtn': {
            if (!prevBtn.disabled) {
                data.currentId--;
                pID.innerHTML = `Patient ID: ${patient.pID}`;
                
                displayImage(dropArea, `${patient.image}`);
                displayImage(gradCAMbox, `${patient.gradCAM}`);

                textBox.innerHTML = `<p><strong>Raw prediction:</strong> ${patient.prediction}</p>
                <p><strong>Predicted class:</strong> ${patient.predClass}</p>
                <p><strong>Confidence:</strong> ${patient.confidence}</p>`;

                if (!data.currentId)
                    disableElement('prevBtn', true);

                if (data.currentId === data.inputData.length-2)
                    disableElement('nextBtn', false);
            }
            break;
        }
        case 'nextBtn' : {
            if (!nextBtn.disabled){
                data.currentId++;
                pID.innerHTML = `Patient ID: ${patient.pID}`;
                
                displayImage(dropArea, `${patient.image}`);
                displayImage(gradCAMbox, `${patient.gradCAM}`);

                textBox.innerHTML = `<p><strong>Raw prediction:</strong> ${patient.prediction}</p>
                <p><strong>Predicted class:</strong> ${patient.predClass}</p>
                <p><strong>Confidence:</strong> ${patient.confidence}</p>`;

                if (data.currentId)
                    disableElement('prevBtn', false);

                if (data.currentId === data.inputData.length-1)
                    disableElement('nextBtn', true);
            }
            break;
        }
        case 'downloadBtn': {
            const link = document.createElement('a');
            link.href = `${patient.gradCAM}`;
            link.download = `GradCAM_${patient.pID}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            break;
        }
        case 'saveBtn': {
            if (checkExisting('#data-popup')) break;

            const popup = document.getElementById('data-popup-template').content.cloneNode(true);
            
            if (dbRow) {
                popup.getElementById("saveBtn").dataset.id = popup.getElementById("deleteBtn").dataset.id = dbRow.id;
                popup.getElementById("deleteBtn").hidden = false;
            }

            const displayData = dbRow ?? patient.toJSON();

            popup.querySelectorAll('[data-field]').forEach(el => {
                const key = el.dataset.field;

                if (key in displayData) {
                   if (el.tagName === "SELECT") {
                        el.value = displayData[key];
                    } else {
                        el.textContent = displayData[key];
                    }
                }
            });
            main.appendChild(popup);
            break;
        }
        case 'deleteRowBtn': {
            deleteFromDatabase(dbRow);
            break;
        }
        case 'settingsBtn': {
            if (checkExisting('#settings-popup')) break;

            const popup = document.getElementById('settings-popup-template').content.cloneNode(true);
            popup.querySelector('[data-field="modelName"]').textContent = data.modelName;
            main.appendChild(popup);

            modelFileInput.addEventListener('change', (e) => {
                    newModel = e.target.files[0];
                    main.querySelector('[data-field="modelName"]').textContent = data.modelName;
                    reloadModel(newModel);
                    controlClick('settingsBtn');
                });
            break;
        }
    }
}

function disableElement(elemId, state) {
    const elem = document.getElementById(elemId);
    elem.disabled = state;
}

async function handleImages(files) {
    if (files.length === 0) return;

    data.resetState();
    
    if (actions.imageBtnsExist) {
        disableElement('prevBtn', true);
        disableElement('nextBtn', true);
        disableElement('saveBtn', true);
        disableElement('downloadBtn', true);
    }

    const formData = new FormData();
    data.imageData ??= [];
    data.imageData.length = 0;

    [...files].forEach((file, index) => {
        formData.append('files', file);

        const reader = new FileReader();
        reader.onload = () => {
            data.imageData.push(reader.result);
            if (index === 0) displayImage(dropArea, data.imageData[data.currentId]);
        };
        reader.readAsDataURL(file);
    });
    
    // Display info, new image and buttons
    Object.assign(imgInfo.style, {
        height: '30px',
        marginBottom: '5px',
        fontSize: '1.5em',
        fontWeight: '600'
    });

    document.querySelector('#innImgContainer').style.setProperty('--height', '85%');
    
    imgInfo.innerHTML = `<p id="pID">Patient ID: ${patient.pID}</p><p id="GradCAMlbl">GradCAM</p>`

    if (!actions.imageBtnsExist) {
        const template = document.getElementById(`imgBtn-template`).content.cloneNode(true);
        document.getElementById("btnContainer").appendChild(template);
        actions.imageBtnsExist = true;
    }

    // Display loading animation, submit the form and await the response
    loadingAnimation();

    try {
        //textBox.innerHTML = '<p>Processing...</p>';
        typeText('Processing...');

        // Send POST request
        const res = await fetch('/api/predict', {
            method: 'POST',
            body: formData
        });

        // Parse response
        data.responseData = await res.json();

        // Display GradCAM
        disableElement('saveBtn', false);
        disableElement('downloadBtn', false);
        displayImage(gradCAMbox, `${patient.gradCAM}`);

        if (files.length > 1)
            disableElement('nextBtn', false);

        // textBox.innerHTML = `<p><strong>Raw prediction:</strong> ${patient.prediction}</p>
        // <p><strong>Predicted class:</strong> ${patient.predClass}</p>
        // <p><strong>Confidence:</strong> ${patient.confidence}%</p>`;
        typeText(`<p><strong>Raw prediction:</strong> ${patient.prediction}</p>
        <p><strong>Predicted class:</strong> ${patient.predClass}</p>
        <p><strong>Confidence:</strong> ${patient.confidence}</p>`, true);

    } catch (error) {
        // textBox.innerHTML = `<p><strong>Error:</strong> ${error.message}</p>`;
        typeText(`<strong>Error:</strong> ${error.message}`);
    }
}

function displayImage(element, uri) {
    // Clear all existing child elements
    element.querySelectorAll('p').forEach(p => p.remove());
    element.querySelectorAll('img').forEach(img => img.remove());
  
    const img = new Image();
    img.src = uri;
    
    Object.assign(img.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      borderRadius: '10px'
    });
  
    Object.assign(element.style, {
      border: '2px solid #ccc'
    });
  
    element.appendChild(img);
  }

function loadingAnimation() {
    gradCAMbox.innerHTML = '';
    const svgElement = `<svg xmlns="http://www.w3.org/2000/svg" id="svgCircle" viewBox="25 25 50 50"><circle r="20" cy="50" cx="50"></circle></svg>`;
    
    if (!gradCAMbox.querySelector('#svgCircle')) {
        gradCAMbox.innerHTML = svgElement;
    }
}

async function checkModelStatus() {
    if (actions.modelStatusChecking) return;

    actions.modelStatusChecking = true;
    try {
        const res = await fetch('/api/model-status');
        const resData = await res.json();
        data.modelName = resData.name;
        
        if (resData.status !== actions.lastStatus) {
            if (resData.status) {
                disableElement('fileInput', false);
                //textBox.innerHTML = '<p>Model is ready!</p>';
                typeText('Model is ready!');
                actions.lastStatus = true;
            } else {
                // textBox.innerHTML = resData.error 
                //     ? `<p><strong>Error:</strong> ${resData.error}</p>`
                //     : '<p>Model is loading...</p>';
                disableElement('fileInput', true);
                resData.error ? typeText(`<strong>Error:</strong> ${resData.error}`) : typeText('Model is loading...');
                actions.lastStatus = resData.error ? null : false;
            }
        }
        // If not loaded, retry after a delay
        if (!resData.status && !resData.error) {
            setTimeout(checkModelStatus, 2000);
        }
    
    } catch (error) {
       //textBox.innerHTML = '<p><strong>Error:</strong> Unable to check model status</p>';
       typeText('<strong>Error:</strong> Unable to check model status');

    } finally {
        actions.modelStatusChecking = false;
    }
}

function typeText(text, multiple = false) {
    // Prevent multiple typing sessions
    if (actions.typingInProgress) return;

    // Reset text and index in non append mode
    textBox.innerHTML = '';
    textBox.dataset.fullText = multiple ? text : `<p>${text}</p>`;
    let index = 0;
    actions.typingInProgress = true;

    function animateTyping() {
        if (index <= text.length && actions.typingInProgress) {
            textBox.innerHTML = multiple ? `${text.slice(0, index)}` : `<p>${text.slice(0, index)}</p>`;
            index++;

            if (index <= text.length) {
                setTimeout(animateTyping, 20);
            } else {
                actions.typingInProgress = false;
            }
        }
    }

    // Start animation
    animateTyping();
}

async function setTemplate(target, targetElementId = 'dataContainer') {
    const heading = document.getElementById("heading").querySelector("h1");
    const element = document.getElementById(targetElementId);

    if (actions.typingInProgress) {
        actions.typingInProgress = false;
        textBox.innerHTML = textBox.dataset.fullText;
    }
    
    // Save main content
    if (actions.currentTab === 'main') data.mainContent = document.getElementById('dataContainer').innerHTML;


    if (target.name === 'main') {
        heading.textContent = "UNILATERAL UTO CLASSIFICATION";
        element.innerHTML = data.mainContent;
        establishMainListeners();
    } else {
        const template = document.getElementById(`${target.name}-template`).content.cloneNode(true);
        heading.textContent = target.text;
        element.replaceChildren(template);

        if(target.name === 'database') {
            loadDatabase();
        }
    }

    // Remember current tab
    actions.currentTab = target.name;
}

function checkExisting(id) {
    const existingPopup = document.querySelector(id);

    if (existingPopup) {
        main.removeChild(existingPopup);
    }

    return Boolean(existingPopup);
}

async function reloadModel(model) {
    try {
        const formData = new FormData();
        formData.append('model_data', model);
        formData.append('filename', model.name);

        // Send POST request
        const res = await fetch('/api/model-reload', {
            method: 'POST',
            body: formData
        });

        checkModelStatus();
                
    } catch (error) {
        // textBox.innerHTML = `<p><strong>Error:</strong> ${error.message}</p>`;
        typeText(`<strong>Error:</strong> ${error.message}`);
    }
}

async function loadDatabase() {
    const res = await fetch("/api/load-database");
    const resData = await res.json();

    tableBody.innerHTML = "";

    resData.forEach(row => {
        // convert prediction value into confidence percent string
        const conf = row.predicted_class === 1 ? row.prediction : (1 - row.prediction);
        row.confidence = (conf * 100).toFixed(1) + "%";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${row.pID}</td>
            <td>${row.date_of_prediction}</td>
            <td>${row.predicted_class}</td>
            <td>${row.confidence}</td>
            <td>${row.reviewer}</td>
            <td>${row.status}</td>
            <td>${row.annotation}</td>
        `;
        tr.addEventListener('click', () => {controlClick('saveBtn',row)});
        tableBody.appendChild(tr);
    });
}

async function save2Database(id = null) {
    try {
        const payload = {
                    id: id,
                    pID: id ? '' : patient.pID,
                    predicted_class: id ? 0 : patient.predClass,
                    prediction: id ? 0 : patient.prediction,
                    reviewer: main.querySelector('[data-field="reviewer"]').textContent,
                    status: main.querySelector('[data-field="status"]').value,
                    annotation: main.querySelector('[data-field="annotation"]').value
                };

        const res = await fetch("/api/save-to-database", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        // Close popup and reload database
        checkExisting('#data-popup');
        if (id) loadDatabase();

    } catch (error) {
        // textBox.innerHTML = `<p><strong>Error:</strong> ${error.message}</p>`;
        //typeText(`<strong>Error:</strong> ${error.message}`);
        console.log(error.message);
    }
}

async function deleteFromDatabase(id) {
    try {
        const res = await fetch("/api/delete-from-database", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({id: id})
        });

        // Close popup and reload database
        checkExisting('#data-popup');
        loadDatabase();

    } catch (error) {
        // textBox.innerHTML = `<p><strong>Error:</strong> ${error.message}</p>`;
        //typeText(`<strong>Error:</strong> ${error.message}`);
        console.log(error.message);
    }
}