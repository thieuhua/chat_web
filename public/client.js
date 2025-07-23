const token = localStorage.getItem('token');
const socket = io({ auth: token ? { token } : {}, autoConnect: false });
const anonSocket = io(); // socket cho ẩn danh

const authControl = document.getElementById('auth-control');
const userList = document.getElementById('users');

const authForm = document.getElementById('auth-forms');
const loginForm = document.getElementById('login-form');

const chatContainer = document.getElementById('chat-container');
const chatHeader = document.getElementById('chat-header');
const chatWithSpan = document.getElementById('chatting-with');
const messages = document.getElementById('messages');
const messagesForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');

let regsisterMode = false;
let anonMode = false;
let isLoggedin = () => {
    return token && token.length > 0;
}

let selectedUser = {id: null, username: 'Ẩn danh'};
let UserInfo = {
    id: null,
    username: 'Ẩn danh'
};
let userListData = [];


function showLogin() {
    alert('mở cửa sổ');
    authForm.style.display = 'block';
    loginForm.style.display = 'block';
}

function switchRegsisterMode() {
    regsisterMode = !regsisterMode;
    document.getElementById('login-form-title').textContent = regsisterMode ? 'Đăng ký' : 'Đăng nhập';
    document.getElementById('username').placeholder = regsisterMode ? 'Tên đăng ký' : 'Tên người dùng';
    document.getElementById('password').placeholder = regsisterMode ? 'Mật khẩu mới' : 'Mật khẩu';
    document.getElementById('login-form-btn').textContent = regsisterMode ? 'Đăng ký' : 'Đăng nhập';

    document.getElementById('register-link').innerHTML = regsisterMode?
        'Đã có tài khoản? <a href="#" onclick="switchRegsisterMode()">Đăng nhập</a>' :
        'Chưa có tài khoản? <a href="#" onclick="switchRegsisterMode()">Đăng ký</a>';
}



function refreshUserList() {
    userList.innerHTML = '';
    userListData.forEach(user => {
        if (user.id == UserInfo.id) return; // không hiển thị chính mình
        if (user.username == 'Ẩn danh') return; // không hiển thị người ẩn danh
        const li = document.createElement('li');
        li.textContent = user.username;
        li.onclick = () => {
            // Cập nhật giao diện người dùng
            userList.querySelectorAll('li').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            selectedUser = user;
            anonMode = false;
            chatWithSpan.textContent = `${user.username}`;

            fetchMessages();
            chatContainer.style.display = 'block';
            authForm.style.display = 'none';
        };
        userList.appendChild(li);
    });
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
    const url = selectedUser.id?
        `/api/messages?to=${selectedUser.id}` :
        '/api/messages';
    fetch(url, {
        headers: {
            'Authorization': `Bearer ${socket.auth.token}`,
        }
    }).then(res => res.json())
    .then(data => {
        messages.innerHTML = ''; // xóa tin nhắn cũ
        data.forEach(msg => addMessage(msg, !!msg.receiver_id));

    })
}



function EnterAnonymous() {
    selectedUser = null;
    messages.innerHTML = ''; // xóa tin nhắn cũ
    chatWithSpan.textContent = 'Chat ẩn danh';
    anonMode = true;

    authForm.style.display = 'none';
    chatContainer.style.display = 'block';
}

function EnterPublicChat() {
    selectedUser = null;
    chatWithSpan.textContent = 'Chat công khai';
    anonMode = false;

    fetchMessages(); // tải tin nhắn công khai

    authForm.style.display = 'none';
    chatContainer.style.display = 'block';

}



loginForm.onsubmit = async (e) => {// xử lý đăng nhập/đăng ký
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const res = await fetch(regsisterMode? '/api/register':'/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok && data.token) { // đăng nhập thành công
        localStorage.setItem('token', data.token);
        authForm.style.display = 'none';
        chatContainer.style.display = 'block';
        socket.auth.token = data.token;
        socket.connect();
        UserInfo = { id: data.user.id, username: data.user.username };
    } else {
        alert('Sai tài khoản hoặc mật khẩu');
    }
};


messagesForm.onsubmit = async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;
    messageInput.value = '';

    if (anonMode) {// gửi tin nhắn ẩn danh
        anonSocket.emit('send message', { to: null, content });
    } else if (selectedUser && selectedUser.id) { // gửi tin nhắn riêng tư
        socket.emit('send message', { to: selectedUser.id, content });
    } else { // gửi tin nhắn công khai
        socket.emit('send message', { to: null, content });
    }
}

socket.on('connect', () => {
    fetch('/api/users', {
            headers: {
                'Authorization': `Bearer ${socket.auth.token}`,
            }
        })
    .then(res => res.json()) 
    .then(users => { /// user
        userListData = users;
        refreshUserList();
        fetchMessages(); // tải tin nhắn khi kết nối
    });
});

socket.on('public message', msg => {
    if (anonMode) return; 
    addMessage(msg, false);
});

socket.on('private message', msg => {
    if (selectedUser && (msg.to === selectedUser.id || msg.from === selectedUser.id)) {
        addMessage(msg, true);
    }
});

anonSocket.on('public message', msg => {
    if (!anonMode) return; 
    addMessage(msg, false);
});

socket.on('connect_error', (err) => {
  console.warn('Lỗi kết nối:', err.message);
  localStorage.removeItem('token');
  location.reload();
});
