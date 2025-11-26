const menuItems = [
    { text: 'Home', file: 'main'},
    { text: 'Instructions', file: 'instructions'},
    { text: 'About', file: 'about'},
    { text: 'Settings', file: 'settings'}
];

let typingInProgress = false;
let mainContent = document.getElementById('main').innerHTML;
let inputData = null;
let responseData = null;

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
                    menuItemEl.addEventListener('click', () => loadPage(item.file));
        
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
            settingsBtn.addEventListener('click', () => toggleSettingsPopup());
        }
    });

    // Methods to run once the main page loads
    establishListeners();
    checkModelStatus();
});

function establishListeners() {
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

    dropArea.addEventListener('drop', (e) => {
        inputData = e.dataTransfer.files;
        fileInput.files = inputData;
        handleImages(inputData);
    });

    fileInput.addEventListener('change', (e) => {
        inputData = e.target.files;
        handleImages(inputData);
    });

    settingsBtn.addEventListener('click', () => toggleSettingsPopup());
}

function addButtons() {
    Object.assign(btnContainer.style, {marginTop: '5px'});

    btnContainer.innerHTML = `
                <div id="imgBtns">
                    <button type="button" id="prevBtn" onclick="controlClick(this.id)" disabled>Prev</button>
                    <button type="button" id="nextBtn" onclick="controlClick(this.id)" disabled>Next</button>
                </div>
                <div id="gradcamBtns">
                    <button type="button" id="download" onclick="controlClick(this.id)" disabled> Download <i class="fa-solid fa-download"></i></button>
                </div>`;

    Object.assign(download.style, {fontSize: '17px', width: '135px'});
}

let currentId = 0;

function controlClick(id) {

    const reader = new FileReader();

    switch(id) {
        case 'prevBtn':
            if (!prevBtn.disabled) {
                currentId--;
                fname = inputData[currentId].name.substring(0, inputData[currentId].name.lastIndexOf("."));
                pID.innerHTML = `Patient ID: ${fname}`;
                reader.onload = (event) => {
                    displayImage(dropArea, event.target.result)
                };
                reader.readAsDataURL(inputData[currentId]);

                displayImage(gradCAMbox, `${responseData[currentId].images.gradcam}`);

                textBox.innerHTML = `<p><strong>Raw prediction for the positive class:</strong> ${responseData[currentId].predictions[0]}</p>
                <p><strong>Predicted class:</strong> ${responseData[currentId].predictions[1]}</p>`;

                if (!currentId)
                    disableElement('prevBtn', true);

                if (currentId === inputData.length-2)
                    disableElement('nextBtn', false);
            }
            break;

        case 'nextBtn' :
            if (!nextBtn.disabled){
                currentId++;
                fname = inputData[currentId].name.substring(0, inputData[currentId].name.lastIndexOf("."));
                pID.innerHTML = `Patient ID: ${fname}`;
                reader.onload = (event) => {
                    displayImage(dropArea, event.target.result)
                };
                reader.readAsDataURL(inputData[currentId]);

                displayImage(gradCAMbox, `${responseData[currentId].images.gradcam}`);

                textBox.innerHTML = `<p><strong>Raw prediction for the positive class:</strong> ${responseData[currentId].predictions[0]}</p>
                <p><strong>Predicted class:</strong> ${responseData[currentId].predictions[1]}</p>`;

                if (currentId)
                    disableElement('prevBtn', false);

                if (currentId === inputData.length-1)
                    disableElement('nextBtn', true);
            }
            break;

        case 'download':
            const link = document.createElement('a');
            link.href = `${responseData[currentId].images.gradcam}`;
            fname = inputData[currentId].name.substring(0, inputData[currentId].name.lastIndexOf("."));
            link.download = `GradCAM_${fname}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            break;
    }
}

function disableElement(elemId, state) {
    const elem = document.getElementById(elemId);
    elem.disabled = state;
}

async function handleImages(files) {
    if (files.length === 0) return;
    
    const f = files[0];
    
    // Display info, new image and buttons
    Object.assign(imgInfo.style, {
        height: '30px',
        marginBottom: '5px',
        fontSize: '1.5em',
        fontWeight: '600'
    });

    document.querySelector('#imageContainer').style.setProperty('--height', '85%');
    
    let fName = f.name.substring(0, f.name.lastIndexOf("."));
    imgInfo.innerHTML = `<p id="pID">Patient ID: ${fName}</p><p id="GradCAMlbl">GradCAM</p>`

    const reader = new FileReader();
    reader.onload = (event) => {
        displayImage(dropArea, event.target.result)
    };
    reader.readAsDataURL(f);

    addButtons();
    
    // Submit the form, await the response and display loading animation
    const formData = new FormData();

    for (const file of files) {
        formData.append('files', file);
    }

    loadingAnimation();

    try {
        //textBox.innerHTML = '<p>Processing...</p>';
        typeText('Processing...');

        // Send POST request
        const response = await fetch('/predict', {
            method: 'POST',
            body: formData
        });

        // Parse response
        responseData = await response.json();

        // Display GradCAM
        disableElement('download', false);
        displayImage(gradCAMbox, `${responseData[0].images.gradcam}`);

        if (files.length > 1)
            disableElement('nextBtn', false);

        // textBox.innerHTML = `<p><strong>Raw prediction for the positive class:</strong> ${responseData[0].predictions[0]}</p>
        // <p><strong>Predicted class:</strong> ${responseData[0].predictions[1]}</p>`;
        typeText(`<p><strong>Raw prediction for the positive class:</strong> ${responseData[0].predictions[0]}</p>
        <p><strong>Predicted class:</strong> ${responseData[0].predictions[1]}</p>`, true);

    } catch (error) {
        // textBox.innerHTML = `<p><strong>Error:</strong> ${error.message}</p>`;
        typeText(`<strong>Error:</strong> ${error.message}`);
    }

    // Save main content if user changes page
    mainContent = document.getElementById('main').innerHTML;
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

let lastStatus = null;
let modelStatusChecking = false;
let modelName = null;

async function checkModelStatus() {
    if (modelStatusChecking) return;

    modelStatusChecking = true;
    try {
        const response = await fetch('/model-status');
        const data = await response.json();
        modelName = data.name;
        
        if (data.status !== lastStatus) {
            if (data.status) {
                disableElement('fileInput', false);
                //textBox.innerHTML = '<p>Model is ready!</p>';
                typeText('Model is ready!');
                lastStatus = true;
            } else {
                // textBox.innerHTML = data.error 
                //     ? `<p><strong>Error:</strong> ${data.error}</p>`
                //     : '<p>Model is loading...</p>';
                disableElement('fileInput', true);
                data.error ? typeText(`<strong>Error:</strong> ${data.error}`) : typeText('Model is loading...');
                lastStatus = data.error ? null : false;
            }
        }
        // If not loaded, retry after a delay
        if (!data.status && !data.error) {
            setTimeout(checkModelStatus, 2000);
        }
    
    } catch (error) {
       //textBox.innerHTML = '<p><strong>Error:</strong> Unable to check model status</p>';
       typeText('<strong>Error:</strong> Unable to check model status');

    } finally {
        modelStatusChecking = false;
    }
}

function typeText(text, multiple = false) {
    // Prevent multiple typing sessions
    if (typingInProgress) return;

    // Reset text and index in non append mode
    textBox.innerHTML = '';

    let index = 0;
    typingInProgress = true;

    function animateTyping() {
        if (index <= text.length) {
            textBox.innerHTML = multiple ? `${text.slice(0, index)}` : `<p>${text.slice(0, index)}</p>`;
            index++;

            if (index <= text.length) {
                setTimeout(animateTyping, 20);
            } else {
                typingInProgress = false;
            }
        }

        // Save main content if user changes page
        mainContent = document.getElementById('main').innerHTML;
    }

    // Start animation
    animateTyping();
}

async function loadPage(pageName, targetElementId = 'main') {
    const element = document.getElementById(targetElementId);
    if (pageName === 'main') {
        element.innerHTML = mainContent;
        establishListeners();
    } else {
        const response = await fetch(`${pageName}.html`);
        element.innerHTML = await response.text();
    }
}

function toggleSettingsPopup() {
  const existingPopup = document.querySelector('.settings-popup');

  if (existingPopup) {
    main.removeChild(existingPopup);
    return;
  }

  const popup = document.createElement('div');
  popup.className = 'settings-popup';
  popup.innerHTML = `
        <div class="popup-item">
                <strong>Current model: </strong> <span id="modelNameTxt"></span>
        </div>
        <div class="popup-item">
            <div id="modelBtnContainer" class="centerFlex">
                <button type="button" id="changeModelBtn" onclick="document.getElementById('modelFileInput').click()">Pick new model</button>
                <form id="modelReloadForm" action="/" method="post" enctype="multipart/form-data" style="display:none;">
                    <input type="file" id="modelFileInput" accept=".keras">
                </form>
            </div>
        </div>
    `;

  main.appendChild(popup);
  modelNameTxt.textContent = modelName;
  modelFileInput.addEventListener('change', (e) => {
        newModel = e.target.files[0];
        modelNameTxt.textContent = newModel.name;
        reloadModel(newModel);
        toggleSettingsPopup();
    });
}

async function reloadModel(model) {
    try {
        const formData = new FormData();
        formData.append('model_data', model);
        formData.append('filename', model.name);

        // Send POST request
        const response = await fetch('/model-reload', {
            method: 'POST',
            body: formData
        });

    } catch (error) {
        // textBox.innerHTML = `<p><strong>Error:</strong> ${error.message}</p>`;
        typeText(`<strong>Error:</strong> ${error.message}`);
    }

    checkModelStatus();
}