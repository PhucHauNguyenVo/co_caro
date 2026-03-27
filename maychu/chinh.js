const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const KY_HIEU = ['X', 'O', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const MAU_NGUOI_CHOI = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#212121', '#ec407a', '#fb8c00', '#3949ab', '#9e9e9e'];
const MAX_PLAYER = 10;
const phongChois = {};
const tenNguoiTheoSocket = {};

function guiThongBao(socket, msg, loai = 'notice') {
  socket.emit('thongbao', { msg, loai });
}

function lamSachTenNguoi(tenNguoiChoi) {
  return typeof tenNguoiChoi === 'string' ? tenNguoiChoi.trim().slice(0, 20) : '';
}

function tenNguoiTrongPhong(phong, nguoi) {
  if (!nguoi) return null;
  return nguoi.ten || phong?.tenTheoId?.[nguoi.id] || tenNguoiTheoSocket[nguoi.id] || null;
}

function dongBoTenNguoiTrongPhong(phong) {
  if (!phong) return;

  phong.nguoiChoi.forEach((nguoi) => {
    const tenDaLuu = phong.tenTheoId?.[nguoi.id] || tenNguoiTheoSocket[nguoi.id];
    if (!nguoi.ten && tenDaLuu) {
      nguoi.ten = tenDaLuu;
    }
    if (nguoi.ten) {
      phong.tenTheoId[nguoi.id] = nguoi.ten;
    }
  });
}

function dongBoThuTuNguoiChoi(phong) {
  if (!phong) return;

  const bangMauNgauNhien = [...MAU_NGUOI_CHOI]
    .sort(() => Math.random() - 0.5)
    .slice(0, phong.nguoiChoi.length);

  phong.kyHieu = {};
  phong.nguoiChoi.forEach((nguoi, index) => {
    const tenDaLuu = tenNguoiTrongPhong(phong, nguoi);
    if (tenDaLuu) {
      nguoi.ten = tenDaLuu;
      phong.tenTheoId[nguoi.id] = tenDaLuu;
    }

    nguoi.soThuTu = index + 1;
    nguoi.kyHieu = KY_HIEU[index] || `P${index + 1}`;
    nguoi.mau = bangMauNgauNhien[index];
    phong.kyHieu[nguoi.id] = nguoi.kyHieu;
  });
}

function duaPhongVeTrangThaiCho(phong) {
  phong.trangThai = 'waiting';
  phong.currentTurn = 1;
  phong.bang = {};
  phong.winner = null;
  phong.winnerId = null;
  phong.winnerTen = null;
  phong.duongThang = [];
  dongBoThuTuNguoiChoi(phong);
}

function taoMaPhongNgauNhien() {
  let maPhongMoi = '';
  do {
    maPhongMoi = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (phongChois[maPhongMoi]);
  return maPhongMoi;
}

function taoMauTheoThuTu(thuTuMau) {
  if (thuTuMau < MAU_NGUOI_CHOI.length) {
    return MAU_NGUOI_CHOI[thuTuMau];
  }

  const hue = (thuTuMau * 137) % 360;
  return `hsl(${hue} 72% 52%)`;
}

function layMauMoiChoPhong(phong) {
  const thuTuMau = Number.isInteger(phong.soMauDaCap) ? phong.soMauDaCap : phong.nguoiChoi.length;
  phong.soMauDaCap = thuTuMau + 1;
  return taoMauTheoThuTu(thuTuMau);
}

function taoKyHieuTheoThuTu(thuTuKyHieu) {
  if (thuTuKyHieu < KY_HIEU.length) {
    return KY_HIEU[thuTuKyHieu];
  }

  return `P${thuTuKyHieu + 1}`;
}

function layKyHieuMoiChoPhong(phong) {
  const thuTuKyHieu = Number.isInteger(phong.soKyHieuDaCap) ? phong.soKyHieuDaCap : phong.nguoiChoi.length;
  phong.soKyHieuDaCap = thuTuKyHieu + 1;
  return taoKyHieuTheoThuTu(thuTuKyHieu);
}

function taoPhongMoi(chuPhongId) {
  return {
    bang: {},
    nguoiChoi: [],
    currentTurn: 1,
    kyHieu: {},
    tenTheoId: {},
    soKyHieuDaCap: 0,
    soMauDaCap: 0,
    trangThai: 'waiting',
    winner: null,
    winnerId: null,
    winnerTen: null,
    duongThang: [],
    chuPhongId
  };
}

function taoDuLieuPhong(phong) {
  dongBoTenNguoiTrongPhong(phong);
  const winnerNguoi = phong.winner
    ? phong.nguoiChoi.find((nguoi) => nguoi.kyHieu === phong.winner)
    : null;
  const tenNguoiTheoId = Object.fromEntries(
    phong.nguoiChoi
      .map((nguoi) => [nguoi.id, tenNguoiTrongPhong(phong, nguoi)])
      .filter(([, ten]) => Boolean(ten))
  );

  return {
    bang: phong.bang,
    nguoiChoi: phong.nguoiChoi.map((nguoi) => ({
      ...nguoi,
      ten: tenNguoiTrongPhong(phong, nguoi)
    })),
    tenNguoiTheoId,
    currentTurn: phong.currentTurn,
    trangThai: phong.trangThai,
    winner: phong.winner,
    winnerId: phong.winnerId,
    winnerTen: phong.winnerTen || tenNguoiTrongPhong(phong, winnerNguoi),
    duongThang: phong.duongThang,
    chuPhongId: phong.chuPhongId
  };
}

function capNhatTrangThaiPhong(phong) {
  if (phong.nguoiChoi.length < 2) {
    phong.trangThai = 'waiting';
    phong.currentTurn = 1;
    phong.winner = null;
    phong.winnerId = null;
    phong.winnerTen = null;
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

function datLaiVanDau(maPhong, phong) {
  duaPhongVeTrangThaiCho(phong);
  guiCapNhatPhong(maPhong);
  io.to(maPhong).emit('choi_lai_xong', {
    maPhong,
    msg: 'Ban co da duoc dat lai. Chu phong co the bam "Bat dau choi" de choi tiep.'
  });
}

function taoPhongMoiTuPhongCu(maPhongCu, phongCu) {
  const maPhongMoi = taoMaPhongNgauNhien();
  const phongMoi = taoPhongMoi(phongCu.chuPhongId);

  phongMoi.nguoiChoi = phongCu.nguoiChoi.map((nguoi) => ({
    ...nguoi,
    ten: tenNguoiTrongPhong(phongCu, nguoi)
  }));
  phongMoi.tenTheoId = { ...(phongCu.tenTheoId || {}) };
  duaPhongVeTrangThaiCho(phongMoi);

  phongChois[maPhongMoi] = phongMoi;

  for (const nguoi of phongMoi.nguoiChoi) {
    const clientSocket = io.sockets.sockets.get(nguoi.id);
    if (!clientSocket) continue;

    clientSocket.leave(maPhongCu);
    clientSocket.join(maPhongMoi);
    clientSocket.data.maPhongHienTai = maPhongMoi;
  }

  delete phongChois[maPhongCu];
  guiCapNhatPhong(maPhongMoi);
  io.to(maPhongMoi).emit('chuyen_phong_moi', {
    maPhongMoi,
    msg: `Da tao phong moi ${maPhongMoi}. Chu phong van duoc giu nguyen.`
  });
}

function capNhatTenNguoiTrongPhong(phong, socketId, tenMoi) {
  const nguoiDangCo = phong?.nguoiChoi.find((nguoi) => nguoi.id === socketId);
  if (!nguoiDangCo) return false;

  nguoiDangCo.ten = tenMoi;
  phong.tenTheoId[socketId] = tenMoi;
  tenNguoiTheoSocket[socketId] = tenMoi;
  if (phong.winner === nguoiDangCo.kyHieu) {
    phong.winnerTen = tenMoi;
  }
  return true;
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

app.use(express.static(path.join(__dirname, '../khach'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

io.on('connection', (socket) => {
  socket.on('vao_phong', ({ maPhong, laTaoPhong, tenNguoiChoi } = {}) => {
    if (typeof maPhong !== 'string' || !maPhong.trim()) {
      guiThongBao(socket, 'Ma phong khong hop le!', 'room_error');
      return;
    }

    const tenDaLamSach = lamSachTenNguoi(tenNguoiChoi);
    if (!tenDaLamSach) {
      guiThongBao(socket, 'Ban can nhap ten nguoi choi!', 'room_error');
      return;
    }

    const maPhongMoi = maPhong.trim().toUpperCase();
    const maPhongHienTai = socket.data.maPhongHienTai;

    if (maPhongHienTai && maPhongHienTai !== maPhongMoi) {
      socket.leave(maPhongHienTai);
    }

    socket.data.maPhongHienTai = maPhongMoi;

    if (laTaoPhong || !phongChois[maPhongMoi]) {
      phongChois[maPhongMoi] = taoPhongMoi(socket.id);
    }

    const phong = phongChois[maPhongMoi];
    const daCoTrongPhong = phong.nguoiChoi.some((nguoi) => nguoi.id === socket.id);

    if (!daCoTrongPhong && phong.nguoiChoi.length >= MAX_PLAYER) {
      guiThongBao(socket, 'Phong da du nguoi!', 'room_error');
      return;
    }

    socket.join(maPhongMoi);
    tenNguoiTheoSocket[socket.id] = tenDaLamSach;
    phong.tenTheoId[socket.id] = tenDaLamSach;

    if (!daCoTrongPhong) {
      phong.nguoiChoi.push({
        id: socket.id,
        ten: tenDaLamSach,
        soThuTu: phong.nguoiChoi.length + 1,
        kyHieu: '',
        mau: ''
      });
    } else {
      capNhatTenNguoiTrongPhong(phong, socket.id, tenDaLamSach);
    }

    if (!phong.chuPhongId) {
      phong.chuPhongId = socket.id;
    }

    duaPhongVeTrangThaiCho(phong);
    capNhatTrangThaiPhong(phong);
    guiCapNhatPhong(maPhongMoi);
  });

  socket.on('cap_nhat_ten', ({ tenNguoiChoi } = {}) => {
    const maPhongHienTai = socket.data.maPhongHienTai;
    if (!maPhongHienTai || !phongChois[maPhongHienTai]) return;

    const tenDaLamSach = lamSachTenNguoi(tenNguoiChoi);
    if (!tenDaLamSach) return;

    const phong = phongChois[maPhongHienTai];
    if (capNhatTenNguoiTrongPhong(phong, socket.id, tenDaLamSach)) {
      guiCapNhatPhong(maPhongHienTai);
    }
  });

  socket.on('bat_dau_choi', () => {
    const maPhongHienTai = socket.data.maPhongHienTai;
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
    phong.winnerId = null;
    phong.winnerTen = null;
    phong.duongThang = [];
    guiCapNhatPhong(maPhongHienTai);
  });

  socket.on('choi_lai', () => {
    const maPhongHienTai = socket.data.maPhongHienTai;
    if (!maPhongHienTai || !phongChois[maPhongHienTai]) return;

    const phong = phongChois[maPhongHienTai];
    if (socket.id !== phong.chuPhongId) {
      guiThongBao(socket, 'Chi chu phong moi duoc choi lai.');
      return;
    }

    if (phong.nguoiChoi.length < 2) {
      guiThongBao(socket, 'Can it nhat 2 nguoi choi de choi lai.');
      return;
    }

    if (phong.trangThai !== 'ended' && phong.trangThai !== 'playing' && phong.trangThai !== 'waiting') {
      guiThongBao(socket, 'Khong the dat lai van dau o thoi diem nay.');
      return;
    }

    taoPhongMoiTuPhongCu(maPhongHienTai, phong);
  });

  socket.on('danhco', ({ x, y } = {}) => {
    const maPhongHienTai = socket.data.maPhongHienTai;
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
      phong.winnerId = nguoiChoi.id;
      phong.winnerTen = tenNguoiTrongPhong(phong, nguoiChoi);
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
      delete phong.tenTheoId[socket.id];
      delete tenNguoiTheoSocket[socket.id];

      if (phong.nguoiChoi.length === 0) {
        delete phongChois[maPhong];
        continue;
      }

      if (phong.chuPhongId === socket.id) {
        phong.chuPhongId = phong.nguoiChoi[0].id;
      }

      duaPhongVeTrangThaiCho(phong);
      capNhatTrangThaiPhong(phong);
      guiCapNhatPhong(maPhong);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`May chu dang chay o cong ${PORT}`);
});
