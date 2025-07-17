const token = localStorage.getItem('token');
const socket = io({ auth: token ? { token } : {}, autoConnect: false });
const anonSocket = io(); // socket cho ẩn danh

const loginForm = document.getElementById('login-form');
const chatBox = document.getElementById('chat');
const anonBox = document.getElementById('anon-chat');

const userList = document.getElementById('user-list');
const messages = document.getElementById('messages');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const anonInput = document.getElementById('anon-input');
const anonSend = document.getElementById('anon-send');


let regsisterMode = false;
let selectedUser = null;
let UserInfo = {
    id: null,
    username: 'Ẩn danh'
};
let userListData = [];


function showLogin() {
    // document.getElementById('mode-selection').style.display = 'none';
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


function enterAnonymous() {
  document.getElementById('mode-selection').style.display = 'none';
  loginForm.style.display = 'none';
  chatBox.style.display = 'none';
  anonBox.style.display = 'block';
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
            fetchMessages();
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
    const url = selectedUser?
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
        loginForm.style.display = 'none';
        chatBox.style.display = 'block';
        socket.auth.token = data.token;
        socket.connect();
        UserInfo = { id: data.user.id, username: data.user.username };
    } else {
        alert('Sai tài khoản hoặc mật khẩu');
    }
};

sendBtn.onclick = () => {
  if (input.value.trim()) {
    socket.emit('send message', {
      to: selectedUser.id,
      content: input.value.trim()
    });
    input.value = '';
  }
};

anonSend.onclick = () => {
  if (anonInput.value.trim()) {
    anonSocket.emit('send message', {
      to: null,
      content: anonInput.value.trim()
    });
    anonInput.value = '';
  }
};

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
    addMessage(msg, false);
});

socket.on('private message', msg => {
    if (selectedUser && (msg.to === selectedUser.id || msg.from === selectedUser.id)) {
        addMessage(msg, true);
    }
});

anonSocket.on('public message', msg => {
  const div = document.createElement('div');
  div.textContent = `[Công khai] ${msg.senderName || 'Ẩn danh'}: ${msg.content}`;
  document.getElementById('anon-messages').appendChild(div);
});

socket.on('connect_error', (err) => {
  console.warn('Lỗi kết nối:', err.message);
  localStorage.removeItem('token');
  location.reload();
});
