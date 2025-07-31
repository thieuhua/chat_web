let token = localStorage.getItem('token');
let anonSocket = io();
let socket;

const authForms = document.getElementById('auth-forms');
const loginForm = document.getElementById('login-form');
const sidebar = document.getElementById('sidebar');
const userInfo = document.getElementById('user-info');
const usernameDisplay = document.getElementById('username-display');
const logoutBtn = document.getElementById('logout-btn');
const loginToggle = document.getElementById('login-toggle');
const chatContainer = document.getElementById('chat-container');
const chatWithSpan = document.getElementById('chatting-with');
const messages = document.getElementById('messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const userList = document.getElementById('users');
const publicChatBtn = document.getElementById('public-chat-btn');
const anonymousChatBtn = document.getElementById('anonymous-chat-btn');
const privateChatSection = document.getElementById('private-chat-section');
const switchRegister = document.getElementById('switch-register');
const loginFormTitle = document.getElementById('login-form-title');
const registerLink = document.getElementById('register-link');

let isRegisterMode = false;
let selectedUser = null; // null = anonymous/public, otherwise {id, username}
let userInfoData = null; // {id, username}

function showAuthForms() {
    authForms.style.display = 'block';
    loginForm.style.display = 'block';
    chatContainer.style.display = 'none';
}
function hideAuthForms() {
    authForms.style.display = 'none';
}

function showChatContainer() {
    chatContainer.style.display = 'block';
    authForms.style.display = 'none';
}

function showSidebarLoginState(islogedIn = false) {
    if(islogedIn && userInfoData) {
        userInfo.style.display = '';
        usernameDisplay.textContent = userInfoData.username;
        logoutBtn.style.display = '';
        loginToggle.style.display = 'none';

        document.querySelectorAll('.require-login').forEach(el => el.style.display = '');
    }
    else {
        userInfo.style.display = 'none';
        logoutBtn.style.display = 'none';
        loginToggle.style.display = '';
        document.querySelectorAll('.require-login').forEach(el => el.style.display = 'none');
    }
}

function setToken(newToken) {
    token = newToken;
    if(token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
}
function getToken() {
    return localStorage.getItem('token');
}

function connectSocketIfNeeded(authToken) {
    // Nếu đã có socket kết nối thì ngắt kết nối cũ
    if(socket) socket.disconnect();
    if(anonSocket) anonSocket.disconnect();
    alert("Tạo kết nối mới nè");
    // Tạo kết nối mới với token nếu có
    socket = io({ auth: authToken ? { token:authToken } : {}, autoConnect: false });
    anonSocket = io();
    // Register event listeners
    setupSocketEvents();
    socket.connect();
}


switchRegister.onclick = function(e) {
    isRegisterMode = !isRegisterMode;
    loginFormTitle.textContent = isRegisterMode ? 'Đăng ký' : 'Đăng nhập';
    document.getElementById('login-form-btn').textContent = isRegisterMode ? 'Đăng ký' : 'Đăng nhập';
    registerLink.innerHTML = isRegisterMode
        ? 'Đã có tài khoản? <a href="#" id="switch-register">Đăng nhập</a>'
        : 'Chưa có tài khoản? <a href="#" id="switch-register">Đăng ký</a>';
    // Re-bind event
    document.getElementById('switch-register').onclick = switchRegister.onclick;
}



function refreshUserList(users) {
    userList.innerHTML = '';
    users.forEach(user => {
        if (user.id === userInfoData.id) return; // không hiển thị chính mình
        // if (user.username == 'Ẩn danh') return; // không hiển thị người ẩn danh
        const li = document.createElement('li');
        li.setAttribute('data-user-id', user.id); // thêm thuộc tính để dễ dàng tìm kiếm
        li.textContent = user.username;

        const dot = document.createElement('span');
        dot.classList.add('unread-dot');
        dot.style.display = 'none'; // tạm ẩn
        li.onclick = () => {
            selectedUser = user;
            chatWithSpan.textContent = `${user.username}`;

            fetchMessages();
            showChatContainer();
            highlightActiveUser(user.id);
            hideNotificationDot(user.id);
        };
        userList.appendChild(li);
    });
}

function showNotificationDot(userId) {
    const li = userList.querySelector(`li[data-user-id="${userId}"]`);
    if (li) {
        const dot = li.querySelector('.unread-dot');
        if (dot) dot.style.display = 'inline-block';
    }
}

function hideNotificationDot(userId) {
    const li = userList.querySelector(`li[data-user-id="${userId}"]`);
    if (li) {
        const dot = li.querySelector('.unread-dot');
        if (dot) dot.style.display = 'none';
    }
}


// Cập nhật danh sách người dùng và đánh dấu người đang chat
function highlightActiveUser(userId) {
  userList.querySelectorAll('li').forEach(el => el.classList.remove('active'));
  if (userId) {
    const activeUser = userList.querySelector(`li[data-user-id="${userId}"]`);
    if (activeUser) {
        activeUser.classList.add('active');
    }
  }
}

function addMessage(msg, private = false) {
    const div = document.createElement('div');
    div.textContent = `${private ? '[Riêng tư]' : '[Công khai]'} ${msg.senderName || 'Ẩn danh'}: ${msg.content}`;
    if (private) {
        div.style.color = 'blue';
    } else {
        div.style.color = 'green';
    }

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight; // cuộn xuống cuối

}

function fetchMessages() {
    const url = selectedUser&&selectedUser.id?
        `/api/messages?to=${selectedUser.id}` :
        '/api/messages';
    let headers ={};
    headers['Authorization'] = `Bearer ${token}`;
    
    fetch(url, { headers })
    .then(res => {
        if(!res.ok) throw new Error("Lỗi tải tin nhắn");
        return res.json();
    })
    .then(data => {
        messages.innerHTML = ''; // xóa tin nhắn cũ
        data.forEach(msg => addMessage(msg, !!msg.receiver_id));
    })
    .catch(err => {
        console.error(err);
        messages.innerHTML = '<div style="color:red">Không tải được tin nhắn</div>';
    })
}



function EnterAnonymousChat() {
    selectedUser = null;
    messages.innerHTML = ''; // xóa tin nhắn cũ
    chatWithSpan.textContent = 'Ẩn danh';
    showChatContainer();
}

function EnterPublicChat() {
    alert("Bạn đang vào phòng chat công khai");
    selectedUser = null;
    chatWithSpan.textContent = 'Công khai';

    fetchMessages(); // tải tin nhắn công khai
    showChatContainer();
}


loginToggle.onclick = showAuthForms;
logoutBtn.onclick = function() {
    setToken(null);
    showSidebarLoginState(false);
    window.location.reload();
};

anonymousChatBtn.onclick = function() {
  selectedUser = null;
  userList.querySelectorAll('li').forEach(el => el.classList.remove('active'));
  EnterAnonymousChat();
};

publicChatBtn.onclick = function() {
  selectedUser = null;
  userList.querySelectorAll('li').forEach(el => el.classList.remove('active'));
  EnterPublicChat();
};



loginForm.onsubmit = async (e) => {// xử lý đăng nhập/đăng ký
    e.preventDefault();
    alert(isRegisterMode ? 'Đang đăng ký...' : 'Đang đăng nhập...');
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const endpoint = isRegisterMode? '/api/register':'/api/login';

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok && data.token) { // đăng nhập thành công
        setToken(data.token);
        alert(data.message || (isRegisterMode ? 'Đăng ký thành công' : 'Đăng nhập thành công'));

        // Lấy thông tin user từ /api/profile
        const profileRes = await fetch('/api/profile', {
            headers: { 'Authorization': `Bearer ${data.token}` }
        });
        if (profileRes.ok) {
            const profileData = await profileRes.json();
            userInfoData = { id: profileData.id, username: profileData.username };
        }

        connectSocketIfNeeded(data.token);
        hideAuthForms();
        showSidebarLoginState(true);
        EnterPublicChat();
    } else {
        alert(data.error || 'Sai tài khoản hoặc mật khẩu');
    }
};


messageForm.onsubmit = function(e) {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;
    messageInput.value = '';
    messageInput.focus();

    if (!userInfoData) {// gửi tin nhắn ẩn danh
        anonSocket.emit('send message', { to: null, content });
    } else if (selectedUser && selectedUser.id) { // gửi tin nhắn riêng tư
        socket.emit('send message', { to: selectedUser.id, content });
    } else { // gửi tin nhắn công khai
        socket.emit('send message', { to: null, content });
    }
}
function setupSocketEvents() {

    socket.on('connect', () => {
        fetch('/api/users', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            })
        .then(res => res.json()) 
        .then(users => { /// user
            refreshUserList(users);
            fetchMessages(); // tải tin nhắn khi kết nối
        });
    });

    socket.on('public message', msg => {
        if ((!selectedUser) && msg.from != null)
            addMessage(msg, false);
    });

    socket.on('private message', msg => {
        if (selectedUser && (msg.to === selectedUser.id || msg.from === selectedUser.id)) {
            addMessage(msg, true);
        }
        if(selectedUser && msg.from !== selectedUser.id) {
            showNotificationDot(msg.from);
        }
    });

    anonSocket.on('public message', msg => {
        if(selectedUser || msg.from) return;
        addMessage(msg, false);
    });

    socket.on('connect_error', (err) => {
        console.warn('Lỗi kết nối:', err.message);
        setToken(null);
        location.reload();
    });

}

async function initialize() {
    const storedToken = getToken();
    setToken(storedToken);


    if (storedToken) {
        try{
            const res = await fetch('/api/profile', {
                headers: {
                    'Authorization': `Bearer ${storedToken}`,
                }
            });
            if (!res.ok) throw new Error("Token không hợp lệ");

            const data = await res.json();
            userInfoData = { id: data.id, username: data.username }; // gán userInfoData

            connectSocketIfNeeded(storedToken);
            showSidebarLoginState(true);
            EnterPublicChat();
        } catch (err) {
            console.warn('Token hết hạn hoặc lỗi xác thực:', err);
            setToken(null);
            EnterAnonymousChat();
        }
    } else {
        EnterAnonymousChat();
    }
}

initialize();