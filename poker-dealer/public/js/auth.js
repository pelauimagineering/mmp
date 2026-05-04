console.log('Auth.js loaded');

// Initialize function
function initAuth() {
    console.log('Initializing auth');

    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const userSelect = document.getElementById('userSelect');
    const displayNameInput = document.getElementById('displayName');

    console.log('loginForm element:', loginForm);
    console.log('errorMessage element:', errorMessage);
    console.log('userSelect element:', userSelect);

    if (!loginForm) {
        console.error('ERROR: loginForm element not found!');
        return;
    }

    // Load available users
    loadUsers();

    // Update display name when user is selected
    userSelect.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const displayName = selectedOption.getAttribute('data-display-name');
        const isLoggedIn = selectedOption.getAttribute('data-logged-in') === 'true';

        console.log('User selected:', selectedOption.value, 'Display name:', displayName, 'Logged in:', isLoggedIn);

        if (displayName) {
            displayNameInput.value = displayName;
        }

        // Show warning if user is already logged in
        if (isLoggedIn) {
            showWarning('⚠️ This user is already logged in on another device. Logging in will create a second session.');
        } else {
            // Clear any previous warnings
            hideWarning();
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // MUST be first!
        e.stopPropagation();
        console.log('Form submit event fired');
        console.log('Default prevented and propagation stopped');

        const userId = userSelect.value;
        const displayName = displayNameInput.value.trim();

        console.log('Attempting login for user ID:', userId, 'with display name:', displayName);

        if (!userId) {
            showError('Please select a user');
            return false;
        }

        if (!displayName) {
            showError('Please enter a display name');
            return false;
        }

        // Create a hidden form to submit the data and allow server redirect
        // This ensures Safari properly receives and stores the session cookie
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/api/auth/login';

        const userIdInput = document.createElement('input');
        userIdInput.type = 'hidden';
        userIdInput.name = 'userId';
        userIdInput.value = userId;

        const displayNameHidden = document.createElement('input');
        displayNameHidden.type = 'hidden';
        displayNameHidden.name = 'displayName';
        displayNameHidden.value = displayName;

        form.appendChild(userIdInput);
        form.appendChild(displayNameHidden);
        document.body.appendChild(form);

        console.log('Submitting form to /api/auth/login');
        form.submit();

        return false; // Extra safeguard
    });

    async function loadUsers() {
        console.log('Loading users list');

        try {
            const response = await fetch('/api/auth/users', {
                credentials: 'same-origin'
            });

            console.log('Users fetch complete, status:', response.status);
            const data = await response.json();
            console.log('Users data:', data);

            if (response.ok && data.users) {
                populateUserDropdown(data.users, data.loggedInUsers || []);
            } else {
                console.error('Failed to load users:', data.error);
                showError('Failed to load users list');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            showError('Network error loading users');
        }
    }

    function populateUserDropdown(users, loggedInUsers) {
        console.log('Populating dropdown with users:', users);
        console.log('Logged in users:', loggedInUsers);

        // Clear existing options except the first one
        while (userSelect.options.length > 1) {
            userSelect.remove(1);
        }

        // Add all users to dropdown
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.display_name} (${user.user_name})`;
            option.setAttribute('data-display-name', user.display_name);
            option.setAttribute('data-logged-in', loggedInUsers.includes(user.id) ? 'true' : 'false');

            // Indicate logged-in users with a visual marker
            if (loggedInUsers.includes(user.id)) {
                option.textContent += ' ✔︎';
            }

            userSelect.appendChild(option);
        });
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.backgroundColor = '#dc3545';
        errorMessage.classList.add('show');

        setTimeout(() => {
            errorMessage.classList.remove('show');
        }, 5000);
    }

    function showWarning(message) {
        errorMessage.textContent = message;
        errorMessage.style.backgroundColor = '#ff9800';
        errorMessage.classList.add('show');
    }

    function hideWarning() {
        if (errorMessage.textContent.includes('✔︎')) {
            errorMessage.classList.remove('show');
        }
    }
}

// Run immediately if DOM is already loaded, otherwise wait for DOMContentLoaded
if (document.readyState === 'loading') {
    console.log('DOM still loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    console.log('DOM already loaded, initializing immediately');
    initAuth();
}