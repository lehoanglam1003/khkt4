import jsQR from 'jsqr';
import QRCode from 'qrcode';
import type { BoundingBox } from '../types/safeai';

export interface CropRect {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  w: number; // 0..1 normalized
  h: number; // 0..1 normalized
}

export interface ImageTransformOptions {
  rotation: 0 | 90 | 180 | 270;
  crop: CropRect | null;
  enhanceContrast: boolean;
}

export interface ImageDiagnostics {
  width: number;
  height: number;
  brightnessScore: number; // 0..255
  sharpnessScore: number; // edge gradient magnitude
  qualityStatus: 'good' | 'low_light' | 'blurry' | 'small';
  qualityLabel: string;
}

export interface MultiRegionQrResult {
  found: boolean;
  value: string;
  regionLabel: string;
  regionsScanned: number;
  qrBbox?: BoundingBox;
}

export async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không thể đọc dữ liệu ảnh.'));
    img.src = src;
  });
}

export async function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Không đọc được tệp ảnh.'));
      }
    };
    reader.onerror = () => reject(new Error('Lỗi khi đọc tệp ảnh.'));
    reader.readAsDataURL(file);
  });
}

export async function analyzeImageDiagnostics(dataUrl: string): Promise<ImageDiagnostics> {
  const img = await loadImageElement(dataUrl);
  const sampleW = Math.min(240, img.naturalWidth || 240);
  const sampleH = Math.max(1, Math.round(((img.naturalHeight || 240) / (img.naturalWidth || 240)) * sampleW));

  const canvas = document.createElement('canvas');
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      brightnessScore: 140,
      sharpnessScore: 20,
      qualityStatus: 'good',
      qualityLabel: 'Sẵn sàng phân tích',
    };
  }
  ctx.drawImage(img, 0, 0, sampleW, sampleH);
  const { data } = ctx.getImageData(0, 0, sampleW, sampleH);

  let lumSum = 0;
  let edgeSum = 0;
  let count = 0;

  for (let y = 0; y < sampleH - 1; y++) {
    for (let x = 0; x < sampleW - 1; x++) {
      const idx = (y * sampleW + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const idxRight = idx + 4;
      const lumRight = 0.299 * data[idxRight] + 0.587 * data[idxRight + 1] + 0.114 * data[idxRight + 2];
      const idxDown = idx + sampleW * 4;
      const lumDown = 0.299 * data[idxDown] + 0.587 * data[idxDown + 1] + 0.114 * data[idxDown + 2];
      lumSum += lum;
      edgeSum += Math.abs(lum - lumRight) + Math.abs(lum - lumDown);
      count++;
    }
  }

  const brightnessScore = count > 0 ? Math.round(lumSum / count) : 140;
  const sharpnessScore = count > 0 ? Math.round((edgeSum / count) * 10) / 10 : 20;

  let qualityStatus: ImageDiagnostics['qualityStatus'] = 'good';
  let qualityLabel = 'Ảnh rõ nét, đủ chi tiết';

  if (img.naturalWidth < 320 || img.naturalHeight < 240) {
    qualityStatus = 'small';
    qualityLabel = 'Độ phân giải thấp — chữ nhỏ có thể khó đọc';
  } else if (brightnessScore < 55) {
    qualityStatus = 'low_light';
    qualityLabel = 'Ảnh hơi tối — nên bật tăng tương phản';
  } else if (sharpnessScore < 8.5) {
    qualityStatus = 'blurry';
    qualityLabel = 'Ảnh hơi mờ — nên bật tăng tương phản hoặc cắt gần vùng chữ';
  }

  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    brightnessScore,
    sharpnessScore,
    qualityStatus,
    qualityLabel,
  };
}

export async function renderTransformedImage(
  dataUrl: string,
  options: ImageTransformOptions,
  maxEdge = 1600
): Promise<string> {
  const img = await loadImageElement(dataUrl);
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  const crop = options.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const sx = Math.max(0, Math.round(crop.x * srcW));
  const sy = Math.max(0, Math.round(crop.y * srcH));
  const sw = Math.max(16, Math.round(crop.w * srcW));
  const sh = Math.max(16, Math.round(crop.h * srcH));

  const rotated = options.rotation === 90 || options.rotation === 270;
  const targetBaseW = rotated ? sh : sw;
  const targetBaseH = rotated ? sw : sh;
  const scale = Math.min(1, maxEdge / Math.max(targetBaseW, targetBaseH));
  const outW = Math.max(1, Math.round(targetBaseW * scale));
  const outH = Math.max(1, Math.round(targetBaseH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return dataUrl;

  ctx.save();
  if (options.enhanceContrast) {
    ctx.filter = 'contrast(1.22) brightness(1.04) saturate(0.95)';
  }
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((options.rotation * Math.PI) / 180);
  const drawW = rotated ? outH : outW;
  const drawH = rotated ? outW : outH;
  ctx.drawImage(img, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Multi-region + multi-scale QR scanner using jsQR.
 * Scans full image, center crop, and quadrants so small QR codes inside tall mobile screenshots are reliably decoded
 * and maps the QR bounding box back to 0..1000 full-image coordinates.
 */
export async function scanQrMultiRegion(dataUrl: string): Promise<MultiRegionQrResult> {
  const img = await loadImageElement(dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const regions: { label: string; x: number; y: number; rw: number; rh: number; upscale?: number }[] = [
    { label: 'toàn ảnh', x: 0, y: 0, rw: 1, rh: 1 },
    { label: 'vùng trung tâm', x: 0.2, y: 0.2, rw: 0.6, rh: 0.6, upscale: 1.5 },
    { label: 'góc trên trái', x: 0, y: 0, rw: 0.55, rh: 0.55, upscale: 1.4 },
    { label: 'góc trên phải', x: 0.45, y: 0, rw: 0.55, rh: 0.55, upscale: 1.4 },
    { label: 'góc dưới trái', x: 0, y: 0.45, rw: 0.55, rh: 0.55, upscale: 1.4 },
    { label: 'góc dưới phải', x: 0.45, y: 0.45, rw: 0.55, rh: 0.55, upscale: 1.4 },
    { label: 'nửa dưới màn hình', x: 0.1, y: 0.5, rw: 0.8, rh: 0.5, upscale: 1.5 },
  ];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { found: false, value: '', regionLabel: '', regionsScanned: 0 };
  }

  let scanned = 0;
  for (const region of regions) {
    scanned++;
    const sx = Math.round(region.x * w);
    const sy = Math.round(region.y * h);
    const sw = Math.max(32, Math.round(region.rw * w));
    const sh = Math.max(32, Math.round(region.rh * h));
    const factor = region.upscale ?? 1;
    const dw = Math.min(1400, Math.round(sw * factor));
    const dh = Math.min(1400, Math.round(sh * factor));

    canvas.width = dw;
    canvas.height = dh;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    const pixels = ctx.getImageData(0, 0, dw, dh);
    const decoded = jsQR(pixels.data, pixels.width, pixels.height, {
      inversionAttempts: 'attemptBoth',
    });
    if (decoded && decoded.data) {
      let qrBbox: BoundingBox | undefined;
      if (decoded.location) {
        const pts = [
          decoded.location.topLeftCorner,
          decoded.location.topRightCorner,
          decoded.location.bottomRightCorner,
          decoded.location.bottomLeftCorner,
        ];
        const minX = Math.max(0, Math.min(...pts.map((p) => p.x)) / dw);
        const maxX = Math.min(1, Math.max(...pts.map((p) => p.x)) / dw);
        const minY = Math.max(0, Math.min(...pts.map((p) => p.y)) / dh);
        const maxY = Math.min(1, Math.max(...pts.map((p) => p.y)) / dh);

        const globalX = Math.round((region.x + minX * region.rw) * 1000);
        const globalY = Math.round((region.y + minY * region.rh) * 1000);
        const globalW = Math.max(20, Math.round((maxX - minX) * region.rw * 1000));
        const globalH = Math.max(20, Math.round((maxY - minY) * region.rh * 1000));
        qrBbox = {
          x: Math.min(980, Math.max(0, globalX)),
          y: Math.min(980, Math.max(0, globalY)),
          w: Math.min(1000 - globalX, globalW),
          h: Math.min(1000 - globalY, globalH),
        };
      }

      return {
        found: true,
        value: decoded.data.trim(),
        regionLabel: region.label,
        regionsScanned: scanned,
        qrBbox,
      };
    }
  }

  return {
    found: false,
    value: '',
    regionLabel: '',
    regionsScanned: scanned,
  };
}

/**
 * Generates realistic test scam/safe screenshot images locally on a Canvas
 * so users can test the upgraded visual & QR recognition in one click.
 */
export async function generateSampleScreenshot(
  kind: 'fake_qr_bank' | 'fake_receipt' | 'safe_carrier' | 'fake_vietqr_police'
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 960;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, 720, 960);

  if (kind === 'fake_vietqr_police') {
    ctx.fillStyle = '#991B1B';
    ctx.fillRect(0, 0, 720, 120);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('GIẤY TRIỆU TẬP & NỘP PHẠT TRỰC TUYẾN', 42, 72);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(40, 155, 640, 750);
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 155, 640, 750);

    ctx.fillStyle = '#991B1B';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('YÊU CẦU XÁC MINH HỒ SƠ CÔNG AN', 70, 220);

    ctx.fillStyle = '#0F172A';
    ctx.font = '23px sans-serif';
    ctx.fillText('Quét mã VietQR dưới đây để chuyển tạm', 70, 285);
    ctx.fillText('500.000đ tiền bảo lãnh xác minh CCCD.', 70, 325);
    ctx.fillText('Tuyệt đối giữ bí mật với người thân.', 70, 375);

    const tlv = (tag: string, val: string) =>
      `${tag}${String(val.length).padStart(2, '0')}${val}`;
    const member = `${tlv('00', '970436')}${tlv('01', '102938475612')}`;
    const m38 = `${tlv('00', 'A000000727')}${tlv('01', member)}${tlv('02', 'QRIBFTTA')}`;
    const body =
      tlv('00', '01') +
      tlv('01', '12') +
      tlv('38', m38) +
      tlv('53', '704') +
      tlv('54', '500000') +
      tlv('58', 'VN') +
      tlv('62', tlv('08', 'Tam giu ho so xac minh')) +
      '6304';
    const { computeEmvCrc16 } = await import('../shared/vietqrParser');
    const vietQrString = body + computeEmvCrc16(body);

    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, vietQrString, {
      width: 260,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    });
    ctx.drawImage(qrCanvas, 230, 440, 260, 260);

    ctx.fillStyle = '#475569';
    ctx.font = '21px sans-serif';
    ctx.fillText('Mã VietQR kho bạc tạm giữ (giả mạo)', 165, 760);
  } else if (kind === 'fake_qr_bank') {
    ctx.fillStyle = '#1E3A8A';
    ctx.fillRect(0, 0, 720, 120);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('THÔNG BÁO KHẨN CẤP NGÂN HÀNG', 40, 72);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(40, 160, 640, 740);
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 160, 640, 740);

    ctx.fillStyle = '#B91C1C';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('TÀI KHOẢN SẮP BỊ KHÓA SAU 2 GIỜ!', 70, 230);

    ctx.fillStyle = '#0F172A';
    ctx.font = '24px sans-serif';
    ctx.fillText('Quý khách vui lòng bấm link hoặc nhập mã OTP', 70, 295);
    ctx.fillText('để xác thực sinh trắc học ngay lập tức:', 70, 335);

    ctx.fillStyle = '#1D4ED8';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('https://vietcombank-xacthuc.xyz/otp', 70, 400);

    ctx.fillStyle = '#0F172A';
    ctx.font = '22px sans-serif';
    ctx.fillText('Hoặc đóng phí xác minh 200.000đ vào STK:', 70, 465);
    ctx.fillText('102938475612 · Hỗ trợ: 0999888777', 70, 505);

    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, 'https://vietcombank-xacthuc.xyz/otp', {
      width: 240,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    });
    ctx.drawImage(qrCanvas, 240, 555, 240, 240);

    ctx.fillStyle = '#475569';
    ctx.font = '20px sans-serif';
    ctx.fillText('Quét mã để mở trang xác thực', 220, 845);
  } else if (kind === 'fake_receipt') {
    ctx.fillStyle = '#047857';
    ctx.fillRect(0, 0, 720, 140);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('CHUYỂN KHOẢN THÀNH CÔNG', 110, 85);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(50, 180, 620, 680);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText('15,000,000 VND', 185, 270);

    ctx.fillStyle = '#334155';
    ctx.font = '24px serif';
    ctx.fillText('Nội dung: Nạp phí giải ngân khoản vay', 90, 360);
    ctx.font = '24px sans-serif';
    ctx.fillText('Người nhận: NGUYEN VAN A', 90, 420);
    ctx.fillText('STK: 889911223344', 90, 475);
    ctx.fillStyle = '#DC2626';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Vui lòng nạp thêm 1.500.000đ để nhận tiền!', 90, 560);
    ctx.fillStyle = '#475569';
    ctx.font = '22px sans-serif';
    ctx.fillText('Liên hệ nhân viên: 0988777666', 90, 620);
  } else {
    ctx.fillStyle = '#0068FF';
    ctx.fillRect(0, 0, 720, 120);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('TIN NHẮN NHÀ MẠNG VINAPHONE', 90, 72);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(50, 170, 620, 420);
    ctx.fillStyle = '#0F172A';
    ctx.font = '25px sans-serif';
    ctx.fillText('VinaPhone thông báo chương trình khuyến mãi', 85, 250);
    ctx.fillText('nạp thẻ ngày vàng dành cho thuê bao trả trước.', 85, 295);
    ctx.fillText('Xem chi tiết thể lệ tại trang chính thức:', 85, 360);
    ctx.fillStyle = '#0068FF';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('https://khuyenmai.vinaphone.com.vn', 85, 415);
    ctx.fillStyle = '#475569';
    ctx.font = '21px sans-serif';
    ctx.fillText('Hoặc kiểm tra trực tiếp trên ứng dụng My VNPT.', 85, 480);
  }

  return canvas.toDataURL('image/png');
}
