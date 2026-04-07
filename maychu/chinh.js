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
const tenNguoiTheoNguoiChoi = {};

function guiThongBao(socket, msg, loai = 'notice') {
  socket.emit('thongbao', { msg, loai });
}

function lamSachTenNguoi(tenNguoiChoi) {
  return typeof tenNguoiChoi === 'string' ? tenNguoiChoi.trim().slice(0, 20) : '';
}

function lamSachNguoiChoiId(nguoiChoiId) {
  return typeof nguoiChoiId === 'string' ? nguoiChoiId.trim().slice(0, 80) : '';
}

function lamSachSocketId(socketId) {
  return typeof socketId === 'string' ? socketId.trim().slice(0, 80) : '';
}

function timNguoiChoiTrongPhong(phong, nguoiChoiId) {
  return phong?.nguoiChoi.find((nguoi) => nguoi.id === nguoiChoiId) || null;
}

function timPhongTheoNguoiChoiId(nguoiChoiId) {
  for (const [maPhong, phong] of Object.entries(phongChois)) {
    const nguoiChoi = timNguoiChoiTrongPhong(phong, nguoiChoiId);
    if (nguoiChoi) {
      return { maPhong, phong, nguoiChoi };
    }
  }

  return null;
}

function tenNguoiTrongPhong(phong, nguoi) {
  if (!nguoi) return null;
  return nguoi.ten || phong?.tenTheoId?.[nguoi.id] || tenNguoiTheoNguoiChoi[nguoi.id] || null;
}

function dongBoTenNguoiTrongPhong(phong) {
  if (!phong) return;

  phong.nguoiChoi.forEach((nguoi) => {
    const tenDaLuu = phong.tenTheoId?.[nguoi.id] || tenNguoiTheoNguoiChoi[nguoi.id];
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

function sapXepLaiThuTuNguoiChoiKhongDoiKyHieu(phong, soThuTuBiXoa = null) {
  if (!phong) return;

  const danhSachNguoiChoi = [...phong.nguoiChoi]
    .sort((a, b) => (a.soThuTu || 0) - (b.soThuTu || 0));

  let nguoiDenLuotTiepTheo = null;
  if (phong.trangThai === 'playing' && danhSachNguoiChoi.length > 0) {
    if (soThuTuBiXoa === phong.currentTurn) {
      nguoiDenLuotTiepTheo = danhSachNguoiChoi.find((nguoi) => (nguoi.soThuTu || 0) > soThuTuBiXoa)
        || danhSachNguoiChoi[0];
    } else {
      nguoiDenLuotTiepTheo = danhSachNguoiChoi.find((nguoi) => nguoi.soThuTu === phong.currentTurn) || null;
    }
  }

  danhSachNguoiChoi.forEach((nguoi, index) => {
    nguoi.soThuTu = index + 1;
  });
  phong.nguoiChoi = danhSachNguoiChoi;

  if (phong.trangThai === 'playing' && nguoiDenLuotTiepTheo) {
    phong.currentTurn = nguoiDenLuotTiepTheo.soThuTu;
  }
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

function xoaNguoiChoiKhoiPhong(maPhong, phong, nguoiChoiId, tuyChon = {}) {
  const idx = phong?.nguoiChoi.findIndex((nguoi) => nguoi.id === nguoiChoiId);
  if (idx === -1) return;

  const nguoiBiXoa = phong.nguoiChoi[idx];
  const tenNguoi = tenNguoiTrongPhong(phong, nguoiBiXoa) || 'Mot nguoi choi';
  const thongBaoChoPhong = tuyChon.thongBaoChoPhong || `${tenNguoi} da roi phong. Van dau duoc dua ve phong cho.`;
  const coDatLaiPhong = tuyChon.datLaiPhong !== false;
  const soThuTuBiXoa = nguoiBiXoa.soThuTu || null;

  phong.nguoiChoi.splice(idx, 1);
  delete phong.kyHieu[nguoiChoiId];
  delete phong.tenTheoId[nguoiChoiId];
  delete tenNguoiTheoNguoiChoi[nguoiChoiId];

  if (phong.nguoiChoi.length === 0) {
    delete phongChois[maPhong];
    return;
  }

  if (phong.chuPhongId === nguoiChoiId) {
    phong.chuPhongId = phong.nguoiChoi[0].id;
  }

  if (coDatLaiPhong) {
    duaPhongVeTrangThaiCho(phong);
  } else {
    sapXepLaiThuTuNguoiChoiKhongDoiKyHieu(phong, soThuTuBiXoa);
  }

  capNhatTrangThaiPhong(phong);
  guiCapNhatPhong(maPhong);

  io.to(maPhong).emit('thongbao', {
    msg: thongBaoChoPhong,
    loai: 'room_notice'
  });
}

function xuLyRoiPhongChuDong({ maPhong, nguoiChoiId, socketId, lyDo } = {}) {
  const maPhongDaLamSach = typeof maPhong === 'string' ? maPhong.trim().toUpperCase() : '';
  const nguoiChoiIdDaLamSach = lamSachNguoiChoiId(nguoiChoiId);
  const socketIdDaLamSach = lamSachSocketId(socketId);

  if (!maPhongDaLamSach || !nguoiChoiIdDaLamSach) {
    return false;
  }

  const phong = phongChois[maPhongDaLamSach];
  if (!phong) {
    return false;
  }

  const nguoiChoi = timNguoiChoiTrongPhong(phong, nguoiChoiIdDaLamSach);
  if (!nguoiChoi) {
    return false;
  }

  if (socketIdDaLamSach && nguoiChoi.socketId && nguoiChoi.socketId !== socketIdDaLamSach) {
    return false;
  }

  let thongBaoChoPhong = `${tenNguoiTrongPhong(phong, nguoiChoi) || 'Mot nguoi choi'} da roi phong. Van dau duoc dua ve phong cho.`;
  if (lyDo === 'reload') {
    thongBaoChoPhong = `${tenNguoiTrongPhong(phong, nguoiChoi) || 'Mot nguoi choi'} da tai lai trang. Phong duoc dua ve cho.`;
  } else if (lyDo === 'switch_room') {
    thongBaoChoPhong = `${tenNguoiTrongPhong(phong, nguoiChoi) || 'Mot nguoi choi'} da roi sang phong khac. Phong duoc dua ve cho.`;
  }

  xoaNguoiChoiKhoiPhong(maPhongDaLamSach, phong, nguoiChoiIdDaLamSach, {
    datLaiPhong: true,
    thongBaoChoPhong
  });

  return true;
}

function kickNguoiChoiKhoiPhong(maPhong, phong, nguoiBiKickId, nguoiKickId) {
  const nguoiBiKick = timNguoiChoiTrongPhong(phong, nguoiBiKickId);
  if (!nguoiBiKick) {
    return { ok: false, msg: 'Khong tim thay nguoi choi can kick.' };
  }

  if (nguoiBiKickId === nguoiKickId) {
    return { ok: false, msg: 'Chu phong khong the tu kick chinh minh.' };
  }

  const tenNguoiBiKick = tenNguoiTrongPhong(phong, nguoiBiKick) || 'Nguoi choi';
  const socketNguoiBiKick = nguoiBiKick.socketId ? io.sockets.sockets.get(nguoiBiKick.socketId) : null;

  if (socketNguoiBiKick) {
    socketNguoiBiKick.leave(maPhong);
    socketNguoiBiKick.data.maPhongHienTai = null;
    socketNguoiBiKick.data.nguoiChoiId = null;
    guiThongBao(socketNguoiBiKick, `Ban da bi chu phong kick khoi phong ${maPhong}.`, 'room_error');
  }

  xoaNguoiChoiKhoiPhong(maPhong, phong, nguoiBiKickId, {
    datLaiPhong: false,
    thongBaoChoPhong: `${tenNguoiBiKick} da bi chu phong kick khoi phong.`
  });

  return { ok: true, msg: `${tenNguoiBiKick} da bi kick khoi phong.` };
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
    const clientSocket = nguoi.socketId ? io.sockets.sockets.get(nguoi.socketId) : null;
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

function capNhatTenNguoiTrongPhong(phong, nguoiChoiId, tenMoi) {
  const nguoiDangCo = phong?.nguoiChoi.find((nguoi) => nguoi.id === nguoiChoiId);
  if (!nguoiDangCo) return false;

  nguoiDangCo.ten = tenMoi;
  phong.tenTheoId[nguoiChoiId] = tenMoi;
  tenNguoiTheoNguoiChoi[nguoiChoiId] = tenMoi;
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

app.post('/roi-phong-beacon', express.text({ type: '*/*', limit: '16kb' }), (req, res) => {
  let duLieu = {};

  try {
    duLieu = typeof req.body === 'string' && req.body
      ? JSON.parse(req.body)
      : {};
  } catch (_err) {
    res.status(400).json({ ok: false });
    return;
  }

  xuLyRoiPhongChuDong(duLieu);
  res.status(200).json({ ok: true });
});

io.on('connection', (socket) => {
  socket.on('vao_phong', ({ maPhong, laTaoPhong, tenNguoiChoi, nguoiChoiId, yeuCauResetSauReload } = {}) => {
    if (typeof maPhong !== 'string' || !maPhong.trim()) {
      guiThongBao(socket, 'Ma phong khong hop le!', 'room_error');
      return;
    }

    const tenDaLamSach = lamSachTenNguoi(tenNguoiChoi);
    if (!tenDaLamSach) {
      guiThongBao(socket, 'Ban can nhap ten nguoi choi!', 'room_error');
      return;
    }

    const nguoiChoiIdDaLamSach = lamSachNguoiChoiId(nguoiChoiId);
    if (!nguoiChoiIdDaLamSach) {
      guiThongBao(socket, 'Khong xac dinh duoc nguoi choi. Hay tai lai trang va thu lai!', 'room_error');
      return;
    }

    const maPhongMoi = maPhong.trim().toUpperCase();
    const maPhongCanResetSauReload = typeof yeuCauResetSauReload?.maPhong === 'string'
      ? yeuCauResetSauReload.maPhong.trim().toUpperCase()
      : '';
    const nguoiChoiIdCuCanReset = lamSachNguoiChoiId(yeuCauResetSauReload?.nguoiChoiIdCu);

    if (maPhongCanResetSauReload && nguoiChoiIdCuCanReset && maPhongCanResetSauReload === maPhongMoi) {
      xuLyRoiPhongChuDong({
        maPhong: maPhongCanResetSauReload,
        nguoiChoiId: nguoiChoiIdCuCanReset,
        lyDo: 'reload'
      });
    }

    const maPhongHienTai = socket.data.maPhongHienTai;
    const thongTinPhongCu = timPhongTheoNguoiChoiId(nguoiChoiIdDaLamSach);

    if (maPhongHienTai && maPhongHienTai !== maPhongMoi) {
      socket.leave(maPhongHienTai);
    }

    if (thongTinPhongCu && thongTinPhongCu.maPhong !== maPhongMoi) {
      xoaNguoiChoiKhoiPhong(thongTinPhongCu.maPhong, thongTinPhongCu.phong, nguoiChoiIdDaLamSach);
    }

    if (!phongChois[maPhongMoi]) {
      phongChois[maPhongMoi] = taoPhongMoi(nguoiChoiIdDaLamSach);
    }

    const phong = phongChois[maPhongMoi];
    const nguoiDangCo = timNguoiChoiTrongPhong(phong, nguoiChoiIdDaLamSach);
    const daCoTrongPhong = Boolean(nguoiDangCo);

    if (!daCoTrongPhong && phong.trangThai !== 'waiting' && phong.nguoiChoi.length > 0) {
      guiThongBao(socket, 'Phong dang trong van choi. Hay doi van sau nhe!', 'room_error');
      return;
    }

    if (!daCoTrongPhong && phong.nguoiChoi.length >= MAX_PLAYER) {
      guiThongBao(socket, 'Phong da du nguoi!', 'room_error');
      return;
    }

    socket.data.maPhongHienTai = maPhongMoi;
    socket.data.nguoiChoiId = nguoiChoiIdDaLamSach;
    socket.join(maPhongMoi);
    tenNguoiTheoNguoiChoi[nguoiChoiIdDaLamSach] = tenDaLamSach;
    phong.tenTheoId[nguoiChoiIdDaLamSach] = tenDaLamSach;

    if (!daCoTrongPhong) {
      phong.nguoiChoi.push({
        id: nguoiChoiIdDaLamSach,
        socketId: socket.id,
        online: true,
        ten: tenDaLamSach,
        soThuTu: phong.nguoiChoi.length + 1,
        kyHieu: '',
        mau: ''
      });
      if (phong.trangThai === 'waiting') {
        duaPhongVeTrangThaiCho(phong);
      }
    } else {
      if (nguoiDangCo.socketId && nguoiDangCo.socketId !== socket.id) {
        const socketCu = io.sockets.sockets.get(nguoiDangCo.socketId);
        if (socketCu) {
          socketCu.leave(maPhongMoi);
        }
      }

      nguoiDangCo.socketId = socket.id;
      nguoiDangCo.online = true;
      capNhatTenNguoiTrongPhong(phong, nguoiChoiIdDaLamSach, tenDaLamSach);
    }

    if (!phong.chuPhongId) {
      phong.chuPhongId = nguoiChoiIdDaLamSach;
    }

    capNhatTrangThaiPhong(phong);
    guiCapNhatPhong(maPhongMoi);

    if (daCoTrongPhong) {
      guiThongBao(socket, 'Da ket noi lai vao phong.', 'room_notice');
    } else if (!laTaoPhong && phong.nguoiChoi.length > 1) {
      io.to(maPhongMoi).emit('thongbao', {
        msg: `${tenDaLamSach} da vao phong.`,
        loai: 'room_notice'
      });
    }
  });

  socket.on('cap_nhat_ten', ({ tenNguoiChoi } = {}) => {
    const maPhongHienTai = socket.data.maPhongHienTai;
    if (!maPhongHienTai || !phongChois[maPhongHienTai]) return;

    const tenDaLamSach = lamSachTenNguoi(tenNguoiChoi);
    if (!tenDaLamSach) return;

    const phong = phongChois[maPhongHienTai];
    if (capNhatTenNguoiTrongPhong(phong, socket.data.nguoiChoiId, tenDaLamSach)) {
      guiCapNhatPhong(maPhongHienTai);
    }
  });

  socket.on('bat_dau_choi', () => {
    const maPhongHienTai = socket.data.maPhongHienTai;
    if (!maPhongHienTai || !phongChois[maPhongHienTai]) return;

    const phong = phongChois[maPhongHienTai];
    if (socket.data.nguoiChoiId !== phong.chuPhongId) {
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
    if (socket.data.nguoiChoiId !== phong.chuPhongId) {
      guiThongBao(socket, 'Chi chu phong moi duoc choi lai.');
      return;
    }

    if (phong.nguoiChoi.length < 2) {
      guiThongBao(socket, 'Can it nhat 2 nguoi choi de choi lai.');
      return;
    }

    if (phong.trangThai !== 'ended') {
      guiThongBao(socket, 'Chi duoc choi lai sau khi van dau da ket thuc.');
      return;
    }

    taoPhongMoiTuPhongCu(maPhongHienTai, phong);
  });

  socket.on('kick_nguoi_choi', ({ nguoiBiKickId } = {}) => {
    const maPhongHienTai = socket.data.maPhongHienTai;
    if (!maPhongHienTai || !phongChois[maPhongHienTai]) return;

    const phong = phongChois[maPhongHienTai];
    if (socket.data.nguoiChoiId !== phong.chuPhongId) {
      guiThongBao(socket, 'Chi chu phong moi duoc kick nguoi choi.');
      return;
    }

    const nguoiBiKickIdDaLamSach = lamSachNguoiChoiId(nguoiBiKickId);
    if (!nguoiBiKickIdDaLamSach) {
      guiThongBao(socket, 'Nguoi choi khong hop le.');
      return;
    }

    const ketQuaKick = kickNguoiChoiKhoiPhong(
      maPhongHienTai,
      phong,
      nguoiBiKickIdDaLamSach,
      socket.data.nguoiChoiId
    );

    if (!ketQuaKick.ok) {
      guiThongBao(socket, ketQuaKick.msg);
    }
  });

  socket.on('danhco', ({ x, y } = {}) => {
    const maPhongHienTai = socket.data.maPhongHienTai;
    if (!maPhongHienTai || !phongChois[maPhongHienTai]) return;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;

    const phong = phongChois[maPhongHienTai];
    if (phong.trangThai !== 'playing') return;

    const nguoiChoi = phong.nguoiChoi.find((nguoi) => nguoi.id === socket.data.nguoiChoiId);
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

  socket.on('roi_phong_chu_dong', ({ maPhong, nguoiChoiId, lyDo } = {}) => {
    xuLyRoiPhongChuDong({
      maPhong: maPhong || socket.data.maPhongHienTai,
      nguoiChoiId: nguoiChoiId || socket.data.nguoiChoiId,
      socketId: socket.id,
      lyDo
    });
    socket.data.maPhongHienTai = null;
    socket.data.nguoiChoiId = null;
  });

  socket.on('disconnect', () => {
    const nguoiChoiId = socket.data.nguoiChoiId;
    if (!nguoiChoiId) return;

    const thongTinPhong = timPhongTheoNguoiChoiId(nguoiChoiId);
    if (!thongTinPhong) return;

    const { maPhong, nguoiChoi } = thongTinPhong;
    if (nguoiChoi.socketId !== socket.id) return;

    nguoiChoi.socketId = null;
    nguoiChoi.online = false;

    io.to(maPhong).emit('thongbao', {
      msg: `${tenNguoiTrongPhong(thongTinPhong.phong, nguoiChoi) || 'Mot nguoi choi'} dang mat ket noi. Van dau se duoc giu nguyen cho den khi nguoi choi vao lai hoac tai lai trang.`,
      loai: 'room_notice'
    });
    guiCapNhatPhong(maPhong);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`May chu dang chay o cong ${PORT}`);
});
