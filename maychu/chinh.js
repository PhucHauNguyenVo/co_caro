const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const KY_HIEU = ['X', 'O', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const MAU_NGUOI_CHOI = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00897b', '#f4511e', '#3949ab', '#6d4c41', '#546e7a'];
const MAX_PLAYER = 10;
const phongChois = {};

function guiThongBao(socket, msg, loai = 'notice') {
  socket.emit('thongbao', { msg, loai });
}

function taoPhongMoi(chuPhongId) {
  return {
    bang: {},
    nguoiChoi: [],
    currentTurn: 1,
    kyHieu: {},
    trangThai: 'waiting',
    winner: null,
    duongThang: [],
    chuPhongId
  };
}

function taoDuLieuPhong(phong) {
  return {
    bang: phong.bang,
    nguoiChoi: phong.nguoiChoi,
    currentTurn: phong.currentTurn,
    trangThai: phong.trangThai,
    winner: phong.winner,
    duongThang: phong.duongThang,
    chuPhongId: phong.chuPhongId
  };
}

function capNhatTrangThaiPhong(phong) {
  if (phong.nguoiChoi.length < 2) {
    phong.trangThai = 'waiting';
    phong.currentTurn = 1;
    phong.winner = null;
    phong.duongThang = [];
    return;
  }

  if (phong.trangThai === 'playing' && (phong.currentTurn < 1 || phong.currentTurn > phong.nguoiChoi.length)) {
    phong.currentTurn = 1;
  }
}

function guiCapNhatPhong(maPhong) {
  const phong = phongChois[maPhong];
  if (!phong) return;

  const data = taoDuLieuPhong(phong);
  io.to(maPhong).emit('capnhat_bang', data);
  io.to(maPhong).emit('capnhat_nguoiChoi', data);
}

function kiemTraThang(bang, x, y, kyHieu) {
  const huongDi = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];

  for (const [dx, dy] of huongDi) {
    const phiaAm = [];
    const phiaDuong = [];

    for (let d = 1; d < 5; d++) {
      const cell = { x: x + dx * d, y: y + dy * d };
      if (bang[`${cell.x},${cell.y}`] !== kyHieu) break;
      phiaDuong.push(cell);
    }

    for (let d = 1; d < 5; d++) {
      const cell = { x: x - dx * d, y: y - dy * d };
      if (bang[`${cell.x},${cell.y}`] !== kyHieu) break;
      phiaAm.push(cell);
    }

    const dayLienTiep = [...phiaAm.reverse(), { x, y }, ...phiaDuong];
    if (dayLienTiep.length >= 5) {
      const viTriNuocMoi = phiaAm.length;
      const batDau = Math.max(0, Math.min(viTriNuocMoi, dayLienTiep.length - 5));
      return dayLienTiep.slice(batDau, batDau + 5);
    }
  }

  return null;
}

app.use(express.static(path.join(__dirname, '../khach')));

app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

io.on('connection', (socket) => {
  let maPhongHienTai = null;

  socket.on('vao_phong', ({ maPhong, laTaoPhong } = {}) => {
    if (typeof maPhong !== 'string' || !maPhong.trim()) {
      guiThongBao(socket, 'Ma phong khong hop le!', 'room_error');
      return;
    }

    const maPhongMoi = maPhong.trim().toUpperCase();

    if (maPhongHienTai && maPhongHienTai !== maPhongMoi) {
      socket.leave(maPhongHienTai);
    }

    maPhongHienTai = maPhongMoi;

    if (laTaoPhong || !phongChois[maPhongHienTai]) {
      phongChois[maPhongHienTai] = taoPhongMoi(socket.id);
    }

    const phong = phongChois[maPhongHienTai];
    const daCoTrongPhong = phong.nguoiChoi.some((nguoi) => nguoi.id === socket.id);

    if (!daCoTrongPhong && phong.nguoiChoi.length >= MAX_PLAYER) {
      guiThongBao(socket, 'Phong da du nguoi!', 'room_error');
      return;
    }

    socket.join(maPhongHienTai);

    if (!daCoTrongPhong) {
      const soThuTu = phong.nguoiChoi.length + 1;
      const kyHieu = KY_HIEU[phong.nguoiChoi.length] || `P${soThuTu}`;
      const mau = MAU_NGUOI_CHOI[phong.nguoiChoi.length % MAU_NGUOI_CHOI.length];
      phong.nguoiChoi.push({ id: socket.id, soThuTu, kyHieu, mau });
      phong.kyHieu[socket.id] = kyHieu;
    }

    if (!phong.chuPhongId) {
      phong.chuPhongId = socket.id;
    }

    capNhatTrangThaiPhong(phong);
    guiCapNhatPhong(maPhongHienTai);
  });

  socket.on('bat_dau_choi', () => {
    if (!maPhongHienTai || !phongChois[maPhongHienTai]) return;

    const phong = phongChois[maPhongHienTai];
    if (socket.id !== phong.chuPhongId) {
      guiThongBao(socket, 'Chi nguoi tao phong moi duoc bat dau van dau.');
      return;
    }

    if (phong.nguoiChoi.length < 2) {
      guiThongBao(socket, 'Can it nhat 2 nguoi choi de bat dau!');
      return;
    }

    phong.trangThai = 'playing';
    phong.currentTurn = 1;
    phong.bang = {};
    phong.winner = null;
    phong.duongThang = [];
    guiCapNhatPhong(maPhongHienTai);
  });

  socket.on('danhco', ({ x, y } = {}) => {
    if (!maPhongHienTai || !phongChois[maPhongHienTai]) return;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;

    const phong = phongChois[maPhongHienTai];
    if (phong.trangThai !== 'playing') return;

    const nguoiChoi = phong.nguoiChoi.find((nguoi) => nguoi.id === socket.id);
    if (!nguoiChoi) return;
    if (nguoiChoi.soThuTu !== phong.currentTurn) return;

    const key = `${x},${y}`;
    if (phong.bang[key]) return;

    phong.bang[key] = nguoiChoi.kyHieu;

    const duongThang = kiemTraThang(phong.bang, x, y, nguoiChoi.kyHieu);
    if (duongThang) {
      phong.trangThai = 'ended';
      phong.winner = nguoiChoi.kyHieu;
      phong.duongThang = duongThang;
    } else {
      phong.currentTurn = (phong.currentTurn % phong.nguoiChoi.length) + 1;
    }

    guiCapNhatPhong(maPhongHienTai);
  });

  socket.on('disconnect', () => {
    for (const [maPhong, phong] of Object.entries(phongChois)) {
      const idx = phong.nguoiChoi.findIndex((nguoi) => nguoi.id === socket.id);
      if (idx === -1) continue;

      phong.nguoiChoi.splice(idx, 1);
      delete phong.kyHieu[socket.id];

      if (phong.nguoiChoi.length === 0) {
        delete phongChois[maPhong];
        continue;
      }

      if (phong.chuPhongId === socket.id) {
        phong.chuPhongId = phong.nguoiChoi[0].id;
      }

      if (idx + 1 < phong.currentTurn) {
        phong.currentTurn--;
      }

      phong.nguoiChoi.forEach((nguoi, index) => {
        nguoi.soThuTu = index + 1;
      });

      if (phong.trangThai === 'ended') {
        const conNguoiThang = phong.nguoiChoi.some((nguoi) => nguoi.kyHieu === phong.winner);
        if (!conNguoiThang) {
          phong.trangThai = 'waiting';
          phong.winner = null;
        }
      }

      if (phong.currentTurn > phong.nguoiChoi.length) {
        phong.currentTurn = 1;
      }

      capNhatTrangThaiPhong(phong);
      guiCapNhatPhong(maPhong);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`May chu dang chay o cong ${PORT}`);
});
