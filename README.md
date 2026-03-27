# Co Caro Online (Demo)

## Mo ta
- Game co caro online, ban co vo han, nhieu nguoi choi, realtime qua trinh duyet.
- Frontend: HTML, JavaScript, Canvas, Socket.IO-client.
- Backend: Node.js, Express, Socket.IO.
- May chu luu trang thai ban co dang key-value (toa do).

## Cach chay local

1. Cai dat Node.js
2. Cai dat dependencies:
   ```
   cd maychu
   npm install
   ```
3. Chay may chu:
   ```
   npm run batdau
   ```
4. Mo trinh duyet truy cap: http://localhost:3000

## Deploy cloud
- Co the deploy len Render, Vercel, v.v. (may chu can phuc vu ca client tinh va Socket.IO)

## Deploy len Render

Repo nay da duoc chuan bi san file `render.yaml` o thu muc goc de Render nhan cau hinh tu dong.

1. Day repo len GitHub
2. Dang nhap Render va chon `New +` -> `Blueprint`
3. Chon repo nay
4. Render se doc file `render.yaml` va tao 1 Web Service voi:
   - `rootDir`: `maychu`
   - `buildCommand`: `npm install`
   - `startCommand`: `npm start`
   - `healthCheckPath`: `/healthz`
5. Bam `Apply`
6. Sau khi deploy xong, mo URL Render cap va choi

Neu ban khong dung Blueprint:

1. Chon `New +` -> `Web Service`
2. Chon repo GitHub cua ban
3. Dien cac gia tri sau:
   - `Runtime`: `Node`
   - `Root Directory`: `maychu`
   - `Build Command`: `npm install`
   - `Start Command`: `npm start`
   - `Health Check Path`: `/healthz`
4. Bam `Create Web Service`

Luu y:
- Render docs cho biet Web Service can lang nghe tren host `0.0.0.0` va dung cong do Render cap qua bien moi truong `PORT`. App nay da dung `process.env.PORT`.
- Sau moi lan push len nhanh duoc ket noi, Render co the tu dong redeploy.

## Ghi chu
- Ban demo chua co phan luot, kiem tra thang thua, phong choi, chong spam.
