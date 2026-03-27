const canvas = document.getElementById('bangcaro');
const ctx = canvas.getContext('2d');
const KICHTHUOC_O = 40;
const SO_O_NHIN = 15;
const MAU_MAC_DINH = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00897b', '#f4511e', '#3949ab', '#6d4c41', '#546e7a'];

let dichuyenX = 0;
let dichuyenY = 0;
let bang = {};
let maNguoiChoi = null;
let nguoiChoi = [];
let luotHienTai = 1;
let maPhong = null;
let trangThaiPhong = 'waiting';
let nguoiThang = null;
let duongThang = [];
let chuPhongId = null;
let laNguoiTaoPhong = false;
let socket = null;

const menu = document.getElementById('menu-phong');
const btnTaoPhong = document.getElementById('tao-phong');
const btnVaoPhong = document.getElementById('vao-phong');
const btnBatDauChoi = document.getElementById('bat-dau-choi');
const inputMaPhong = document.getElementById('ma-phong');
const thongbao = document.getElementById('thongbao');
const thongTinPhong = document.getElementById('thong-tin-phong');
const maPhongHienThi = document.getElementById('ma-phong-hienthi');
const danhSachNguoiChoi = document.getElementById('danhsach-nguoi-choi');
const trangthai = document.getElementById('trangthai');

function randomMaPhong() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function resetTrangThaiPhong() {
  bang = {};
  maNguoiChoi = null;
  nguoiChoi = [];
  luotHienTai = 1;
  dichuyenX = 0;
  dichuyenY = 0;
  trangThaiPhong = 'waiting';
  nguoiThang = null;
  duongThang = [];
  chuPhongId = null;
}

function roiPhongHienTai() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

function mauNguoiChoi(nguoi, index) {
  return nguoi?.mau || MAU_MAC_DINH[index % MAU_MAC_DINH.length];
}

function laChuPhong() {
  return Boolean(laNguoiTaoPhong || (maNguoiChoi && maNguoiChoi === chuPhongId));
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
  bang = data.bang || {};
  nguoiChoi = Array.isArray(data.nguoiChoi) ? data.nguoiChoi : [];
  luotHienTai = Number.isInteger(data.currentTurn) ? data.currentTurn : 1;
  trangThaiPhong = data.trangThai || 'waiting';
  nguoiThang = data.winner || null;
  duongThang = Array.isArray(data.duongThang) ? data.duongThang : [];
  chuPhongId = data.chuPhongId || chuPhongId || (laNguoiTaoPhong ? maNguoiChoi : null);

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

  veBang();
  veDanhSachNguoiChoi();
  capNhatNutBatDau();
  veTrangThai();
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
  veBang();
  veDanhSachNguoiChoi();
  capNhatNutBatDau();
  veTrangThai();
}

function hienThongBaoTrongPhong(msg) {
  if (thongbao) {
    thongbao.innerText = msg;
  }
  if (trangthai && msg) {
    trangthai.innerText = msg;
  }
}

function batDauVaoPhong(maPhongMoi, laTao) {
  maPhong = maPhongMoi;
  laNguoiTaoPhong = laTao;

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
  roiPhongHienTai();
  veBang();
  veDanhSachNguoiChoi();
  capNhatNutBatDau();
  veTrangThai();

  socket = io();
  socket.on('connect', () => {
    maNguoiChoi = socket.id;
    chuPhongId = laNguoiTaoPhong ? socket.id : chuPhongId;
    capNhatNutBatDau();
    veTrangThai();
    socket.emit('vao_phong', { maPhong, laTaoPhong: laNguoiTaoPhong });
  });
  socket.on('capnhat_bang', dongBoTrangThaiPhong);
  socket.on('capnhat_nguoiChoi', dongBoTrangThaiPhong);
  socket.on('thongbao', ({ msg, loai }) => {
    if (loai === 'room_error') {
      hienLoiPhong(msg || 'Khong the vao phong.');
      return;
    }
    hienThongBaoTrongPhong(msg || 'Khong the thuc hien thao tac nay.');
  });
}

function xuLyClickBanCo(e) {
  if (!socket || trangThaiPhong !== 'playing') return;

  const nguoiDangDi = nguoiChoi[luotHienTai - 1];
  if (!nguoiDangDi || nguoiDangDi.id !== maNguoiChoi) return;

  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / KICHTHUOC_O) + dichuyenX;
  const y = Math.floor((e.clientY - rect.top) / KICHTHUOC_O) + dichuyenY;
  socket.emit('danhco', { x, y });
}

function veDanhSachNguoiChoi() {
  if (!danhSachNguoiChoi) return;

  if (nguoiChoi.length === 0) {
    danhSachNguoiChoi.innerHTML = '';
    return;
  }

  danhSachNguoiChoi.innerHTML = nguoiChoi.map((nguoi, index) => {
    const tenNguoi = nguoi.kyHieu || `Nguoi choi ${nguoi.soThuTu || index + 1}`;
    const nhanToi = nguoi.id === maNguoiChoi ? ' (ban)' : '';
    const nhanChuPhong = nguoi.id === chuPhongId ? ' - chu phong' : '';
    const nhanLuot = index === luotHienTai - 1 && trangThaiPhong === 'playing' ? ' - dang di' : '';
    return `
      <div class="the-nguoi-choi">
        <span class="cham-mau" style="background:${mauNguoiChoi(nguoi, index)};"></span>
        <span>${tenNguoi}${nhanToi}${nhanChuPhong}${nhanLuot}</span>
      </div>
    `;
  }).join('');
}

function capNhatNutBatDau() {
  if (!btnBatDauChoi) return;

  const coTheBatDau = nguoiChoi.length >= 2 && trangThaiPhong === 'waiting';
  btnBatDauChoi.style.display = laChuPhong() ? 'inline-block' : 'none';
  btnBatDauChoi.disabled = !coTheBatDau;
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
    .filter((o) => o.x >= 0 && o.x < SO_O_NHIN && o.y >= 0 && o.y < SO_O_NHIN);
  const nguoiThangCuoc = nguoiChoi.find((nguoi) => nguoi.kyHieu === nguoiThang);
  const mauThang = nguoiThangCuoc ? mauNguoiChoi(nguoiThangCuoc, nguoiChoi.indexOf(nguoiThangCuoc)) : '#ff5252';

  for (let i = 0; i < SO_O_NHIN; i++) {
    for (let j = 0; j < SO_O_NHIN; j++) {
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

    for (let i = 0; i < SO_O_NHIN; i++) {
      for (let j = 0; j < SO_O_NHIN; j++) {
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
    const nguoiThangCuoc = nguoiChoi.find((nguoi) => nguoi.kyHieu === nguoiThang);
    const tenNguoiThang = nguoiThangCuoc ? nguoiThangCuoc.kyHieu : nguoiThang;
    if (nguoiChoiCuaToi && nguoiChoiCuaToi.kyHieu === nguoiThang) {
      trangthai.innerText = `Ban thang! Duong 5 quan cua ${tenNguoiThang} dang duoc to sang.`;
    } else {
      trangthai.innerText = `Van dau ket thuc. Nguoi thang: ${tenNguoiThang}`;
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

if (btnBatDauChoi) {
  btnBatDauChoi.onclick = () => {
    if (!socket) return;
    socket.emit('bat_dau_choi');
  };
}

canvas.addEventListener('click', xuLyClickBanCo);
veBang();
veDanhSachNguoiChoi();
capNhatNutBatDau();
veTrangThai();
