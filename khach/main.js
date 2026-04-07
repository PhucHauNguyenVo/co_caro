const canvas = document.getElementById('bangcaro');
const ctx = canvas.getContext('2d');
const KICHTHUOC_O = 40;
const KHOA_LUU_NGUOI_CHOI = 'caro:nguoi-choi-id';
const KHOA_RESET_SAU_RELOAD = 'caro:reset-sau-reload';
let soONgang = 15;
let soODoc = 15;
const MAU_MAC_DINH = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00897b', '#f4511e', '#3949ab', '#6d4c41', '#546e7a'];

let dichuyenX = 0;
let dichuyenY = 0;
let bang = {};
let maNguoiChoi = layHoacTaoNguoiChoiId();
let nguoiChoi = [];
let luotHienTai = 1;
let maPhong = null;
let trangThaiPhong = 'waiting';
let nguoiThang = null;
let maNguoiThang = null;
let tenNguoiThang = null;
let duongThang = [];
let chuPhongId = null;
let laNguoiTaoPhong = false;
let socket = null;
let tenNguoiChoi = '';
let cacheTenNguoiChoi = {};

const menu = document.getElementById('menu-phong');
const btnTaoPhong = document.getElementById('tao-phong');
const btnVaoPhong = document.getElementById('vao-phong');
const btnBatDauChoi = document.getElementById('bat-dau-choi');
const btnChoiLai = document.getElementById('choi-lai');
const btnCopyMaPhong = document.getElementById('copy-ma-phong');
const inputTenNguoiChoi = document.getElementById('ten-nguoi-choi');
const inputMaPhong = document.getElementById('ma-phong');
const thongbao = document.getElementById('thongbao');
const thongTinPhong = document.getElementById('thong-tin-phong');
const maPhongHienThi = document.getElementById('ma-phong-hienthi');
const danhSachNguoiChoi = document.getElementById('danhsach-nguoi-choi');
const trangthai = document.getElementById('trangthai');
const trangthaiHanhDong = document.getElementById('trangthai-hanh-dong');
const boardFrame = document.getElementById('board-frame');
const btnChoiLaiNoiBat = document.getElementById('choi-lai-noi-bat');

let dangKeoBanCo = false;
let diemBatDauKeo = null;
let dichuyenBatDau = null;
let vuaKeoBanCo = false;
let trangThaiPhongTruocDo = 'waiting';
let daGuiTinHieuRoiPhong = false;

function taoNguoiChoiIdNgauNhien() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function layHoacTaoNguoiChoiId() {
  try {
    const nguoiChoiDaLuu = window.localStorage?.getItem(KHOA_LUU_NGUOI_CHOI);
    if (nguoiChoiDaLuu) {
      return nguoiChoiDaLuu;
    }

    const nguoiChoiMoi = taoNguoiChoiIdNgauNhien();
    window.localStorage?.setItem(KHOA_LUU_NGUOI_CHOI, nguoiChoiMoi);
    return nguoiChoiMoi;
  } catch (_err) {
    return taoNguoiChoiIdNgauNhien();
  }
}

function randomMaPhong() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function layTenNguoiChoi() {
  const tenDaNhap = inputTenNguoiChoi?.value.trim().slice(0, 20) || '';
  if (tenDaNhap) {
    return tenDaNhap;
  }

  if (thongbao) {
    thongbao.innerText = 'Vui long nhap ten nguoi choi truoc khi tham gia phong!';
  }
  inputTenNguoiChoi?.focus();
  return null;
}

function resetTrangThaiPhong() {
  bang = {};
  nguoiChoi = [];
  luotHienTai = 1;
  dichuyenX = 0;
  dichuyenY = 0;
  trangThaiPhong = 'waiting';
  nguoiThang = null;
  maNguoiThang = null;
  tenNguoiThang = null;
  duongThang = [];
  chuPhongId = null;
  cacheTenNguoiChoi = {};
  trangThaiPhongTruocDo = 'waiting';
}

function guiBeaconRoiPhong(lyDo = 'reload') {
  if (!maPhong || !maNguoiChoi || typeof navigator.sendBeacon !== 'function') {
    return;
  }

  try {
    const payload = new Blob([
      JSON.stringify({
        maPhong,
        nguoiChoiId: maNguoiChoi,
        socketId: socket?.id || null,
        lyDo
      })
    ], { type: 'application/json' });
    navigator.sendBeacon('/roi-phong-beacon', payload);
  } catch (_err) {
    // Bo qua loi beacon, socket se la duong du phong khi con ket noi.
  }
}

function luuYeuCauResetSauReload() {
  if (!maPhong || !maNguoiChoi) {
    return;
  }

  try {
    window.sessionStorage?.setItem(KHOA_RESET_SAU_RELOAD, JSON.stringify({
      maPhong,
      nguoiChoiIdCu: maNguoiChoi
    }));
    window.localStorage?.removeItem(KHOA_LUU_NGUOI_CHOI);
  } catch (_err) {
    // Bo qua loi storage trong luc unload.
  }
}

function layYeuCauResetSauReload(maPhongDich) {
  try {
    const duLieuDaLuu = window.sessionStorage?.getItem(KHOA_RESET_SAU_RELOAD);
    if (!duLieuDaLuu) {
      return null;
    }

    window.sessionStorage?.removeItem(KHOA_RESET_SAU_RELOAD);
    const duLieu = JSON.parse(duLieuDaLuu);
    if (!duLieu || duLieu.maPhong !== maPhongDich || !duLieu.nguoiChoiIdCu) {
      return null;
    }

    return duLieu;
  } catch (_err) {
    return null;
  }
}

function baoRoiPhongChuDong(lyDo = 'reload') {
  if (daGuiTinHieuRoiPhong || !maPhong || !maNguoiChoi) {
    return;
  }

  daGuiTinHieuRoiPhong = true;
  if (lyDo === 'reload') {
    luuYeuCauResetSauReload();
  }
  guiBeaconRoiPhong(lyDo);
  if (socket?.connected) {
    socket.emit('roi_phong_chu_dong', {
      maPhong,
      nguoiChoiId: maNguoiChoi,
      lyDo
    });
  }
}

function roiPhongHienTai(lyDo = 'switch_room') {
  if (!socket) return;
  baoRoiPhongChuDong(lyDo);
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

function mauNguoiChoi(nguoi, index) {
  return nguoi?.mau || MAU_MAC_DINH[index % MAU_MAC_DINH.length];
}

function tenHienThiNguoiChoi(nguoi, index) {
  const tenDaLuu = nguoi?.id ? cacheTenNguoiChoi[nguoi.id] : '';
  if (tenDaLuu) {
    return tenDaLuu;
  }

  if (nguoi?.ten) {
    return nguoi.ten;
  }

  if (nguoi?.id === maNguoiChoi && tenNguoiChoi) {
    return tenNguoiChoi;
  }

  return `Nguoi choi ${nguoi?.soThuTu || index + 1}`;
}

function laChuPhong() {
  return Boolean(laNguoiTaoPhong || (maNguoiChoi && maNguoiChoi === chuPhongId));
}

function dangTrongVanChoi() {
  return trangThaiPhong === 'playing' || trangThaiPhong === 'ended';
}

function capNhatCheDoBanCo() {
  document.body.classList.toggle('playing-mode', dangTrongVanChoi());
  capNhatKichThuocBanCo();
}

function capNhatKichThuocBanCo() {
  if (!boardFrame || canvas.style.display === 'none') return;

  const width = Math.max(320, Math.floor(boardFrame.clientWidth));
  const height = Math.max(360, Math.floor(boardFrame.clientHeight));

  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }

  soONgang = Math.ceil(canvas.width / KICHTHUOC_O);
  soODoc = Math.ceil(canvas.height / KICHTHUOC_O);

  veBang();
}

function timThongTinThangTuBang() {
  const huongDi = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];
  const daDuyet = new Set();

  for (const [key, kyHieu] of Object.entries(bang)) {
    const [xBatDau, yBatDau] = key.split(',').map(Number);
    if (!Number.isInteger(xBatDau) || !Number.isInteger(yBatDau) || !kyHieu) continue;

    for (const [dx, dy] of huongDi) {
      const maHuong = `${key}|${dx}|${dy}`;
      if (daDuyet.has(maHuong)) continue;

      const xTruoc = xBatDau - dx;
      const yTruoc = yBatDau - dy;
      if (bang[`${xTruoc},${yTruoc}`] === kyHieu) continue;

      const dayLienTiep = [];
      let x = xBatDau;
      let y = yBatDau;
      while (bang[`${x},${y}`] === kyHieu) {
        dayLienTiep.push({ x, y });
        daDuyet.add(`${x},${y}|${dx}|${dy}`);
        x += dx;
        y += dy;
      }

      if (dayLienTiep.length >= 5) {
        return {
          winner: kyHieu,
          duongThang: dayLienTiep.slice(0, 5)
        };
      }
    }
  }

  return null;
}

function dongBoTrangThaiPhong(data = {}) {
  const trangThaiMoi = data.trangThai || 'waiting';
  const vuaQuayVePhongCho = trangThaiMoi === 'waiting' && trangThaiPhongTruocDo !== 'waiting';

  bang = data.bang || {};
  nguoiChoi = Array.isArray(data.nguoiChoi) ? data.nguoiChoi : [];
  const tenNguoiTheoId = data.tenNguoiTheoId && typeof data.tenNguoiTheoId === 'object'
    ? data.tenNguoiTheoId
    : {};
  Object.entries(tenNguoiTheoId).forEach(([id, ten]) => {
    if (ten) {
      cacheTenNguoiChoi[id] = ten;
    }
  });
  nguoiChoi.forEach((nguoi) => {
    if (nguoi?.id && nguoi.ten) {
      cacheTenNguoiChoi[nguoi.id] = nguoi.ten;
    }
  });
  nguoiChoi = nguoiChoi.map((nguoi, index) => {
    const tenDaBiet = tenHienThiNguoiChoi(nguoi, index);
    return tenDaBiet && tenDaBiet !== `Nguoi choi ${nguoi?.soThuTu || index + 1}`
      ? { ...nguoi, ten: tenDaBiet }
      : nguoi;
  });
  luotHienTai = Number.isInteger(data.currentTurn) ? data.currentTurn : 1;
  trangThaiPhong = trangThaiMoi;
  nguoiThang = data.winner || null;
  maNguoiThang = data.winnerId || null;
  tenNguoiThang = data.winnerTen || null;
  duongThang = Array.isArray(data.duongThang) ? data.duongThang : [];
  chuPhongId = data.chuPhongId || chuPhongId || (laNguoiTaoPhong ? maNguoiChoi : null);

  const nguoiCuaToi = nguoiChoi.find((nguoi) => nguoi.id === maNguoiChoi);
  if (socket && maNguoiChoi && tenNguoiChoi && (!nguoiCuaToi || nguoiCuaToi.ten !== tenNguoiChoi)) {
    socket.emit('cap_nhat_ten', { tenNguoiChoi });
  }

  if ((trangThaiPhong === 'ended' && (!nguoiThang || duongThang.length === 0)) || (!nguoiThang && duongThang.length === 0)) {
    const thongTinThang = timThongTinThangTuBang();
    if (thongTinThang) {
      nguoiThang = nguoiThang || thongTinThang.winner;
      duongThang = thongTinThang.duongThang;
      if (trangThaiPhong !== 'ended') {
        trangThaiPhong = 'ended';
      }
    }
  }

  if (vuaQuayVePhongCho) {
    dichuyenX = 0;
    dichuyenY = 0;
    if (menu) {
      menu.style.display = 'none';
    }
    if (thongTinPhong) {
      thongTinPhong.style.display = 'block';
    }
    canvas.style.display = 'block';
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  capNhatCheDoBanCo();
  veBang();
  veDanhSachNguoiChoi();
  capNhatNutBatDau();
  veTrangThai();
  trangThaiPhongTruocDo = trangThaiPhong;
}

function hienLoiPhong(msg) {
  if (thongbao) {
    thongbao.innerText = msg;
  }
  if (menu) {
    menu.style.display = '';
  }
  if (thongTinPhong) {
    thongTinPhong.style.display = 'none';
  }
  canvas.style.display = 'none';
  resetTrangThaiPhong();
  capNhatCheDoBanCo();
  veBang();
  veDanhSachNguoiChoi();
  capNhatNutBatDau();
  veTrangThai();
}

function hienThongBaoTrongPhong(msg, capNhatTrangThai = true) {
  if (thongbao) {
    thongbao.innerText = msg;
  }
  if (capNhatTrangThai && trangthai && msg) {
    trangthai.innerText = msg;
  }
}

function hienPhongChoSauChoiLai(maPhongMoi = null, msg = '') {
  dichuyenX = 0;
  dichuyenY = 0;
  trangThaiPhong = 'waiting';
  nguoiThang = null;
  maNguoiThang = null;
  tenNguoiThang = null;
  duongThang = [];
  if (maPhongMoi) {
    maPhong = maPhongMoi;
  }

  if (menu) {
    menu.style.display = 'none';
  }
  if (thongTinPhong) {
    thongTinPhong.style.display = 'block';
  }
  if (maPhongHienThi && maPhong) {
    maPhongHienThi.innerText = maPhong;
  }
  canvas.style.display = 'block';

  capNhatCheDoBanCo();
  veBang();
  veDanhSachNguoiChoi();
  capNhatNutBatDau();
  veTrangThai();
  trangThaiPhongTruocDo = 'waiting';

  if (msg) {
    hienThongBaoTrongPhong(msg, false);
  }
  if (typeof window.scrollTo === 'function') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function guiYeuCauChoiLai() {
  if (!socket) return;

  if (!laChuPhong()) {
    hienThongBaoTrongPhong('Chi chu phong moi duoc choi lai.');
    return;
  }

  hienThongBaoTrongPhong('Dang tao phong moi va chuyen ca nhom sang ma phong moi...', false);
  socket.emit('choi_lai');
}

function guiYeuCauKickNguoiChoi(nguoiBiKickId) {
  if (!socket) return;

  if (!laChuPhong()) {
    hienThongBaoTrongPhong('Chi chu phong moi duoc kick nguoi choi.');
    return;
  }

  const nguoiBiKick = nguoiChoi.find((nguoi) => nguoi.id === nguoiBiKickId);
  if (!nguoiBiKick || nguoiBiKick.id === maNguoiChoi) {
    return;
  }

  const tenNguoi = tenHienThiNguoiChoi(nguoiBiKick, nguoiChoi.indexOf(nguoiBiKick));
  const dongYKick = window.confirm(`Kick ${tenNguoi} khoi phong?`);
  if (!dongYKick) {
    return;
  }

  socket.emit('kick_nguoi_choi', { nguoiBiKickId });
}

async function copyMaPhongHienTai() {
  if (!maPhong) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(maPhong);
    } else {
      const inputTam = document.createElement('input');
      inputTam.value = maPhong;
      document.body.appendChild(inputTam);
      inputTam.select();
      document.execCommand('copy');
      document.body.removeChild(inputTam);
    }

    hienThongBaoTrongPhong(`Da copy ma phong: ${maPhong}`, false);
  } catch (_err) {
    hienThongBaoTrongPhong('Khong copy duoc ma phong. Hay thu lai.');
  }
}

function batDauVaoPhong(maPhongMoi, laTao) {
  const tenDaNhap = layTenNguoiChoi();
  if (!tenDaNhap) return;

  const maPhongSapVao = maPhongMoi;
  const seLaNguoiTaoPhong = laTao;
  const tenSapDung = tenDaNhap;
  const yeuCauResetSauReload = layYeuCauResetSauReload(maPhongSapVao);

  roiPhongHienTai('switch_room');
  daGuiTinHieuRoiPhong = false;

  maPhong = maPhongSapVao;
  laNguoiTaoPhong = seLaNguoiTaoPhong;
  tenNguoiChoi = tenSapDung;

  if (menu) {
    menu.style.display = 'none';
  }
  if (thongTinPhong) {
    thongTinPhong.style.display = 'block';
  }
  if (maPhongHienThi) {
    maPhongHienThi.innerText = maPhong;
  }
  if (thongbao) {
    thongbao.innerText = '';
  }

  canvas.style.display = 'block';
  resetTrangThaiPhong();
  capNhatCheDoBanCo();
  veBang();
  veDanhSachNguoiChoi();
  capNhatNutBatDau();
  veTrangThai();

  socket = io();
  socket.on('connect', () => {
    cacheTenNguoiChoi[maNguoiChoi] = tenNguoiChoi;
    chuPhongId = laNguoiTaoPhong ? maNguoiChoi : chuPhongId;
    capNhatNutBatDau();
    veTrangThai();
    socket.emit('vao_phong', {
      maPhong,
      laTaoPhong: laNguoiTaoPhong,
      tenNguoiChoi,
      nguoiChoiId: maNguoiChoi,
      yeuCauResetSauReload
    });
    socket.emit('cap_nhat_ten', { tenNguoiChoi });
  });
  socket.on('capnhat_bang', dongBoTrangThaiPhong);
  socket.on('capnhat_nguoiChoi', dongBoTrangThaiPhong);
  socket.on('chuyen_phong_moi', ({ maPhongMoi, msg } = {}) => {
    if (!maPhongMoi) return;
    maPhong = maPhongMoi;
    if (maPhongHienThi) {
      maPhongHienThi.innerText = maPhongMoi;
    }
    hienPhongChoSauChoiLai(maPhongMoi, msg || `Da chuyen sang phong moi ${maPhongMoi}.`);
  });
  socket.on('choi_lai_xong', ({ maPhongMoi, maPhong: maPhongCu, msg } = {}) => {
    hienPhongChoSauChoiLai(maPhongMoi || maPhongCu || maPhong, msg || 'Ban co da duoc dat lai.');
  });
  socket.on('thongbao', ({ msg, loai }) => {
    if (loai === 'room_error') {
      hienLoiPhong(msg || 'Khong the vao phong.');
      return;
    }
    hienThongBaoTrongPhong(msg || 'Khong the thuc hien thao tac nay.', loai !== 'room_notice');
  });
}

function xuLyClickBanCo(e) {
  if (vuaKeoBanCo) {
    vuaKeoBanCo = false;
    return;
  }
  if (!socket || trangThaiPhong !== 'playing') return;

  const nguoiDangDi = nguoiChoi[luotHienTai - 1];
  if (!nguoiDangDi || nguoiDangDi.id !== maNguoiChoi) return;

  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / KICHTHUOC_O) + dichuyenX;
  const y = Math.floor((e.clientY - rect.top) / KICHTHUOC_O) + dichuyenY;
  socket.emit('danhco', { x, y });
}

function batDauKeoBanCo(e) {
  if (!dangTrongVanChoi()) return;

  dangKeoBanCo = true;
  vuaKeoBanCo = false;
  diemBatDauKeo = { x: e.clientX, y: e.clientY };
  dichuyenBatDau = { x: dichuyenX, y: dichuyenY };
  boardFrame?.classList.add('dragging');
}

function dangKeo(e) {
  if (!dangKeoBanCo || !diemBatDauKeo || !dichuyenBatDau) return;

  const deltaX = e.clientX - diemBatDauKeo.x;
  const deltaY = e.clientY - diemBatDauKeo.y;
  if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
    vuaKeoBanCo = true;
  }

  dichuyenX = dichuyenBatDau.x - Math.round(deltaX / KICHTHUOC_O);
  dichuyenY = dichuyenBatDau.y - Math.round(deltaY / KICHTHUOC_O);
  veBang();
}

function ketThucKeoBanCo() {
  dangKeoBanCo = false;
  diemBatDauKeo = null;
  dichuyenBatDau = null;
  boardFrame?.classList.remove('dragging');
}

function veDanhSachNguoiChoi() {
  if (!danhSachNguoiChoi) return;

  if (nguoiChoi.length === 0) {
    danhSachNguoiChoi.innerHTML = '';
    return;
  }

  danhSachNguoiChoi.innerHTML = nguoiChoi.map((nguoi, index) => {
    const tenNguoi = tenHienThiNguoiChoi(nguoi, index);
    const nhanKyHieu = nguoi.kyHieu ? ` (${nguoi.kyHieu})` : '';
    const nhanToi = nguoi.id === maNguoiChoi ? ' (ban)' : '';
    const nhanChuPhong = nguoi.id === chuPhongId ? ' - chu phong' : '';
    const nhanMatKetNoi = nguoi.online === false ? ' - mat ket noi' : '';
    const nhanLuot = index === luotHienTai - 1 && trangThaiPhong === 'playing' && nguoi.online !== false
      ? ' - dang di'
      : '';
    const nutKick = laChuPhong() && nguoi.id !== maNguoiChoi
      ? `<button class="nut-kick" type="button" data-kick-nguoi-choi="${nguoi.id}">Kick</button>`
      : '';
    return `
      <div class="the-nguoi-choi">
        <span class="cham-mau" style="background:${mauNguoiChoi(nguoi, index)};"></span>
        <span class="ten-nguoi-choi-wrap">
          <span>${tenNguoi}${nhanKyHieu}${nhanToi}${nhanChuPhong}${nhanMatKetNoi}${nhanLuot}</span>
          ${nutKick}
        </span>
      </div>
    `;
  }).join('');
}

function capNhatNutBatDau() {
  const laChu = laChuPhong();
  const coTheBatDau = nguoiChoi.length >= 2 && trangThaiPhong === 'waiting';
  const coTheChoiLai = nguoiChoi.length >= 2 && trangThaiPhong === 'ended';

  if (btnBatDauChoi) {
    btnBatDauChoi.style.display = laChu && trangThaiPhong === 'waiting' ? 'inline-flex' : 'none';
    btnBatDauChoi.disabled = !coTheBatDau;
  }

  if (btnChoiLai) {
    btnChoiLai.style.display = laChu && trangThaiPhong === 'ended' ? 'inline-flex' : 'none';
    btnChoiLai.disabled = !coTheChoiLai;
  }

  if (trangthaiHanhDong) {
    trangthaiHanhDong.style.display = laChu && trangThaiPhong === 'ended' ? 'flex' : 'none';
  }

  if (btnChoiLaiNoiBat) {
    btnChoiLaiNoiBat.style.display = laChu && trangThaiPhong === 'ended' ? 'inline-flex' : 'none';
    btnChoiLaiNoiBat.disabled = !coTheChoiLai;
  }
}

function veQuanCo(x, y, mau, { mo = false, noiBat = false } = {}) {
  ctx.save();
  ctx.fillStyle = mau;
  ctx.globalAlpha = mo ? 0.08 : 1;
  ctx.beginPath();
  ctx.arc(
    x * KICHTHUOC_O + KICHTHUOC_O / 2,
    y * KICHTHUOC_O + KICHTHUOC_O / 2,
    KICHTHUOC_O / 2 - 4,
    0,
    2 * Math.PI
  );
  ctx.fill();

  if (noiBat) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fffde7';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#fff176';
    ctx.shadowBlur = 20;
    ctx.stroke();
  }
  ctx.restore();
}

function veBang() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const dangHighlightThang = trangThaiPhong === 'ended' && duongThang.length > 0;
  const setDuongThang = new Set(duongThang.map((o) => `${o.x},${o.y}`));
  const diemHienThiThang = duongThang
    .map((o) => ({ x: o.x - dichuyenX, y: o.y - dichuyenY }))
    .filter((o) => o.x >= 0 && o.x < soONgang && o.y >= 0 && o.y < soODoc);
  const nguoiThangCuoc = nguoiChoi.find((nguoi) => nguoi.kyHieu === nguoiThang);
  const mauThang = nguoiThangCuoc ? mauNguoiChoi(nguoiThangCuoc, nguoiChoi.indexOf(nguoiThangCuoc)) : '#ff5252';

  for (let i = 0; i < soONgang; i++) {
    for (let j = 0; j < soODoc; j++) {
      ctx.strokeStyle = dangHighlightThang ? 'rgba(120, 120, 120, 0.08)' : '#bbb';
      ctx.strokeRect(i * KICHTHUOC_O, j * KICHTHUOC_O, KICHTHUOC_O, KICHTHUOC_O);

      const key = `${i + dichuyenX},${j + dichuyenY}`;
      if (!bang[key]) continue;

      const nguoiSoHuuNuocDi = nguoiChoi.find((nguoi) => nguoi.kyHieu === bang[key]);
      const indexNguoi = nguoiSoHuuNuocDi ? nguoiChoi.indexOf(nguoiSoHuuNuocDi) : 0;
      const mauCo = nguoiSoHuuNuocDi ? mauNguoiChoi(nguoiSoHuuNuocDi, indexNguoi) : '#616161';
      const laOThang = setDuongThang.has(key);
      veQuanCo(i, j, mauCo, {
        mo: dangHighlightThang && !laOThang,
        noiBat: dangHighlightThang && laOThang
      });
    }
  }

  if (dangHighlightThang) {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 20, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    for (const diem of diemHienThiThang) {
      ctx.save();
      ctx.fillStyle = `${mauThang}55`;
      ctx.fillRect(
        diem.x * KICHTHUOC_O,
        diem.y * KICHTHUOC_O,
        KICHTHUOC_O,
        KICHTHUOC_O
      );
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.shadowColor = mauThang;
      ctx.shadowBlur = 20;
      ctx.strokeRect(
        diem.x * KICHTHUOC_O + 2,
        diem.y * KICHTHUOC_O + 2,
        KICHTHUOC_O - 4,
        KICHTHUOC_O - 4
      );
      ctx.restore();
    }

    for (let i = 0; i < soONgang; i++) {
      for (let j = 0; j < soODoc; j++) {
        const key = `${i + dichuyenX},${j + dichuyenY}`;
        if (!setDuongThang.has(key) || !bang[key]) continue;

        const nguoiSoHuuNuocDi = nguoiChoi.find((nguoi) => nguoi.kyHieu === bang[key]);
        const indexNguoi = nguoiSoHuuNuocDi ? nguoiChoi.indexOf(nguoiSoHuuNuocDi) : 0;
        const mauCo = nguoiSoHuuNuocDi ? mauNguoiChoi(nguoiSoHuuNuocDi, indexNguoi) : '#616161';
        veQuanCo(i, j, mauCo, { noiBat: true });
      }
    }

    if (diemHienThiThang.length >= 2) {
      const diemDau = diemHienThiThang[0];
      const diemCuoi = diemHienThiThang[diemHienThiThang.length - 1];
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.shadowColor = mauThang;
      ctx.shadowBlur = 28;
      ctx.beginPath();
      ctx.moveTo(
        diemDau.x * KICHTHUOC_O + KICHTHUOC_O / 2,
        diemDau.y * KICHTHUOC_O + KICHTHUOC_O / 2
      );
      ctx.lineTo(
        diemCuoi.x * KICHTHUOC_O + KICHTHUOC_O / 2,
        diemCuoi.y * KICHTHUOC_O + KICHTHUOC_O / 2
      );
      ctx.stroke();
      ctx.restore();
    }
  }
}

function veTrangThai() {
  if (!trangthai) return;

  if (trangThaiPhong === 'ended' && nguoiThang) {
    const nguoiChoiCuaToi = nguoiChoi.find((nguoi) => nguoi.id === maNguoiChoi);
    const nguoiThangCuoc = nguoiChoi.find((nguoi) => nguoi.id === maNguoiThang)
      || nguoiChoi.find((nguoi) => nguoi.kyHieu === nguoiThang);
    const tenNguoiTheoDanhSach = nguoiThangCuoc
      ? tenHienThiNguoiChoi(nguoiThangCuoc, nguoiChoi.indexOf(nguoiThangCuoc))
      : null;
    const tenNguoiThangHienThi = (tenNguoiThang && tenNguoiThang !== nguoiThang ? tenNguoiThang : null)
      || tenNguoiTheoDanhSach
      || tenNguoiThang
      || nguoiThang;
    if (nguoiChoiCuaToi && nguoiChoiCuaToi.kyHieu === nguoiThang) {
      trangthai.innerText = laChuPhong()
        ? `Ban thang! Nguoi thang: ${tenNguoiThangHienThi}. Bam "Choi lai" de tao phong moi cho ca nhom.`
        : `Ban thang! Nguoi thang: ${tenNguoiThangHienThi}.`;
    } else {
      trangthai.innerText = laChuPhong()
        ? `Van dau ket thuc. Nguoi thang: ${tenNguoiThangHienThi}. Bam "Choi lai" de tao phong moi va giu nguyen chu phong.`
        : `Van dau ket thuc. Nguoi thang: ${tenNguoiThangHienThi}`;
    }
    return;
  }

  if (trangThaiPhong === 'waiting') {
    if (nguoiChoi.length < 2) {
      trangthai.innerText = laChuPhong()
        ? 'Ban da vao phong. Cho them nguoi choi tham gia...'
        : 'Dang cho them nguoi choi...';
      return;
    }

    if (laChuPhong()) {
      trangthai.innerText = 'Ban la chu phong. Bam "Bat dau choi" khi san sang.';
    } else {
      trangthai.innerText = 'Dang cho chu phong bat dau van choi...';
    }
    return;
  }

  const nguoiDangDi = nguoiChoi[luotHienTai - 1];
  if (nguoiDangDi && nguoiDangDi.online === false) {
    trangthai.innerText = 'Dang cho nguoi choi ket noi lai...';
    return;
  }

  if (nguoiDangDi && nguoiDangDi.id === maNguoiChoi) {
    trangthai.innerText = 'Den luot ban!';
    return;
  }

  trangthai.innerText = 'Dang cho nguoi khac di...';
}

if (btnTaoPhong) {
  btnTaoPhong.onclick = () => {
    batDauVaoPhong(randomMaPhong(), true);
  };
}

if (btnVaoPhong) {
  btnVaoPhong.onclick = () => {
    const val = inputMaPhong.value.trim().toUpperCase();
    if (!val) {
      if (thongbao) {
        thongbao.innerText = 'Vui long nhap ma phong!';
      }
      return;
    }

    batDauVaoPhong(val, false);
  };
}

if (inputTenNguoiChoi) {
  inputTenNguoiChoi.addEventListener('input', () => {
    if (thongbao?.innerText === 'Vui long nhap ten nguoi choi truoc khi tham gia phong!') {
      thongbao.innerText = '';
    }
  });
}

if (btnBatDauChoi) {
  btnBatDauChoi.onclick = () => {
    if (!socket) return;
    socket.emit('bat_dau_choi');
  };
}

if (btnChoiLai) {
  btnChoiLai.onclick = () => {
    guiYeuCauChoiLai();
  };
}

if (btnChoiLaiNoiBat) {
  btnChoiLaiNoiBat.onclick = () => {
    guiYeuCauChoiLai();
  };
}

if (btnCopyMaPhong) {
  btnCopyMaPhong.onclick = () => {
    copyMaPhongHienTai();
  };
}

if (danhSachNguoiChoi) {
  danhSachNguoiChoi.addEventListener('click', (e) => {
    const nutKick = e.target.closest('[data-kick-nguoi-choi]');
    if (!nutKick) return;

    guiYeuCauKickNguoiChoi(nutKick.getAttribute('data-kick-nguoi-choi'));
  });
}

window.addEventListener('pagehide', () => {
  baoRoiPhongChuDong('reload');
});

window.addEventListener('beforeunload', () => {
  baoRoiPhongChuDong('reload');
});

canvas.addEventListener('click', xuLyClickBanCo);
canvas.addEventListener('pointerdown', batDauKeoBanCo);
window.addEventListener('pointermove', dangKeo);
window.addEventListener('pointerup', ketThucKeoBanCo);
window.addEventListener('pointercancel', ketThucKeoBanCo);
window.addEventListener('resize', capNhatKichThuocBanCo);
capNhatCheDoBanCo();
veBang();
veDanhSachNguoiChoi();
capNhatNutBatDau();
veTrangThai();
