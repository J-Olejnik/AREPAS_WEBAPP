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
            showNotification('No GradCAM available to download', 'warning');
            return;
        }

        const link = document.createElement('a');
        link.href = patient.gradCAM;
        link.download = `GradCAM_${patient.pID}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('GradCAM downloaded', 'success');
    }

    function showLoadingAnimation() {
        const gradCAMbox = document.getElementById(ELEMENTS.GRADCAM_BOX);
        gradCAMbox.innerHTML = '';
        const svgElement = `<svg xmlns="http://www.w3.org/2000/svg" id="svgCircle" viewBox="25 25 50 50"><circle r="20" cy="50" cx="50"></circle></svg>`;
        
        if (!gradCAMbox.querySelector('#svgCircle')) {
            gradCAMbox.innerHTML = svgElement;
        }
    }

    function disableElement(elemId, state) {
        const elem = document.getElementById(elemId);
        elem.disabled = state;
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
        if (state.ui.typingInProgress) return;

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
                    setTimeout(animate, CONFIG.TYPING_SPEED);
                } else {
                    AppState.updateUI({ typingInProgress: false });
                }
            }
        }

        animate();
    }

    function showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // TODO: Implement popup for notifications
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