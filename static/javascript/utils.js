import { ELEMENTS, CONFIG } from './constants.js';
import { AppState } from './services.js';

export const DOMHelpers = (() => {
    function displayImage(element, uri) {
        element.querySelectorAll('p, img').forEach(el => el.remove());
        
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

    function downloadGradCAM() {
        const patient = AppState.getPatient();
        if (!patient) {
            showNotification('No GradCAM available to download', 'Warning');
            return;
        }

        const link = document.createElement('a');
        link.href = patient.gradCAM;
        link.download = `GradCAM_${patient.pID}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('GradCAM downloaded', 'Success');
    }

    function showLoadingAnimation(show = true) {
        const gradCAMbox = document.getElementById(ELEMENTS.GRADCAM_BOX);
        gradCAMbox.innerHTML = '';

        if(show) {
            const svgElement = `<svg xmlns="http://www.w3.org/2000/svg" id="svgCircle" viewBox="25 25 50 50"><circle r="20" cy="50" cx="50"></circle></svg>`;
            
            if (!gradCAMbox.querySelector('#svgCircle')) {
                gradCAMbox.innerHTML = svgElement;
            }
        }
    }

    function disableElement(elemId, state) {
        const elem = document.getElementById(elemId);

        // Update live element if present
        if (elem) {
            if ('disabled' in elem.dataset) {
                elem.dataset.disabled = String(state);
            } else {
                elem.disabled = state;
            }
            return;
        }

        // Element not in DOM, try updating stored HTML
        const appState = AppState.getState();
        const parser = new DOMParser();
        const doc = parser.parseFromString(appState.data.mainContent, 'text/html');
        const storedElem = doc.getElementById(elemId);
        
        if (!storedElem) return;
        
        if ('disabled' in storedElem.dataset || storedElem.hasAttribute('data-disabled')) {
            storedElem.dataset.disabled = String(state);
        } else {
            if (state) {
                storedElem.setAttribute('disabled', '');
            } else {
                storedElem.removeAttribute('disabled');
            }
        }
        
        AppState.updateData({ mainContent: doc.body.innerHTML });
    }

    function checkExisting(id, remove = false) {
        const existingPopup = document.getElementById(id);

        if (existingPopup && remove) {
            document.getElementById(ELEMENTS.MAIN).removeChild(existingPopup);
        }

        return Boolean(existingPopup);
    }

    function openPopup(templateId, data = {}) {
        const template = document.getElementById(templateId).content.cloneNode(true);
        
        // Populate data fields
        template.querySelectorAll('[data-field]').forEach(el => {
            const key = el.dataset.field;
            if (key in data) {
                if (el.tagName === "SELECT") {
                    el.value = data[key];
                } else {
                    el.textContent = data[key];
                }
            }
        });
        
        document.getElementById(ELEMENTS.MAIN).appendChild(template);
    }

    function typeText(text, multiple = false) {
        const state = AppState.getState();
        if (state.ui.currentTab !== 'main') return;

        if (state.ui.typingTimeout) {
            clearTimeout(state.ui.typingTimeout);
            AppState.updateUI({ typingTimeout: null });
        }

        const textBox = document.getElementById(ELEMENTS.TEXT_BOX);
        textBox.innerHTML = '';
        textBox.dataset.fullText = multiple ? text : `<p>${text}</p>`;
        
        let index = 0;
        AppState.updateUI({ typingInProgress: true });

        function animate() {
            if (index <= text.length && state.ui.typingInProgress) {
                textBox.innerHTML = multiple ? text.slice(0, index) : `<p>${text.slice(0, index)}</p>`;
                index++;

                if (index <= text.length) {
                    AppState.updateUI({ typingTimeout: setTimeout(animate, CONFIG.TYPING_SPEED) })
                } else {
                    AppState.updateUI({ typingInProgress: false });
                }
            }
        }

        animate();
    }

    function showNotification(message, type, timeout = CONFIG.TOAST_TIMEOUT) {
        checkExisting(ELEMENTS.TOAST_POPUP, true);

        const toast = document.createElement('div');
        toast.id = 'toast-popup';
        toast.className = 'popup';
        toast.innerHTML = `<div class="popup-item"><span class="toast-type">${type}:</span> ${message}</div>`;
        
        document.getElementById(ELEMENTS.MAIN).appendChild(toast);
        
        setTimeout(() => toast.remove(), timeout);
    }

    return {
        displayImage,
        downloadGradCAM,
        showLoadingAnimation,
        disableElement,
        checkExisting,
        openPopup,
        typeText,
        showNotification
    };
})();

export const Utils = (() => {
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    return {
        debounce,
        throttle
    };
})();