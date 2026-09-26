/**
 * Pre-configured realistic sample image generators
 * Includes the prompt's exact example: WhatsApp Chat with Phone, Timestamp, Reply, ART. No.
 */

export function generateChatSample() {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');

  // WhatsApp Dark theme background
  ctx.fillStyle = '#0b141a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle doodle wallpaper background pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // Header Bar
  ctx.fillStyle = '#1f2c34';
  ctx.fillRect(0, 0, canvas.width, 70);

  // Header Text
  ctx.fillStyle = '#e9edef';
  ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('+44 7775 583342', 80, 38);

  ctx.fillStyle = '#8696a0';
  ctx.font = '400 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Online', 80, 56);

  // Avatar circle
  ctx.fillStyle = '#00a884';
  ctx.beginPath();
  ctx.arc(42, 35, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('JD', 42, 41);
  ctx.textAlign = 'left';

  // Date divider
  ctx.fillStyle = '#182229';
  ctx.beginPath();
  ctx.roundRect(canvas.width / 2 - 80, 95, 160, 28, 8);
  ctx.fill();
  ctx.fillStyle = '#8696a0';
  ctx.font = '500 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('10/02/2025, 3:08 pm', canvas.width / 2, 114);
  ctx.textAlign = 'left';

  // Inbound Message Bubble
  const bubbleX = 40;
  const bubbleY = 150;
  const bubbleW = 440;
  const bubbleH = 180;

  ctx.fillStyle = '#202c33';
  ctx.beginPath();
  ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 12);
  ctx.fill();

  // Message Sender Name
  ctx.fillStyle = '#53bdeb';
  ctx.font = '600 14px sans-serif';
  ctx.fillText('+44 7775 583342', bubbleX + 16, bubbleY + 28);

  // Message Content
  ctx.fillStyle = '#e9edef';
  ctx.font = '400 16px sans-serif';
  ctx.fillText('Please dispatch order immediately.', bubbleX + 16, bubbleY + 62);
  ctx.fillText('Reference code is: ART. No. 250', bubbleX + 16, bubbleY + 92);

  // Reply pill inside message
  ctx.fillStyle = '#111b21';
  ctx.beginPath();
  ctx.roundRect(bubbleX + 16, bubbleY + 115, 80, 30, 6);
  ctx.fill();
  ctx.fillStyle = '#00a884';
  ctx.font = '600 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Reply', bubbleX + 56, bubbleY + 135);
  ctx.textAlign = 'left';

  // Timestamp in bubble
  ctx.fillStyle = '#8696a0';
  ctx.font = '400 12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('10/02/2025, 3:08 pm', bubbleX + bubbleW - 16, bubbleY + bubbleH - 14);
  ctx.textAlign = 'left';

  // Bottom Input Bar
  ctx.fillStyle = '#1f2c34';
  ctx.fillRect(0, canvas.height - 65, canvas.width, 65);
  ctx.fillStyle = '#2a3942';
  ctx.beginPath();
  ctx.roundRect(20, canvas.height - 52, canvas.width - 90, 40, 8);
  ctx.fill();
  ctx.fillStyle = '#8696a0';
  ctx.font = '400 14px sans-serif';
  ctx.fillText('Type a message...', 36, canvas.height - 27);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    presetElements: [
      {
        id: 'sample_phone_1',
        type: 'line',
        text: '+44 7775 583342',
        confidence: 99,
        bbox: { x0: 78, y0: 20, x1: 270, y1: 42, width: 192, height: 22 }
      },
      {
        id: 'sample_date_divider',
        type: 'line',
        text: '10/02/2025, 3:08 pm',
        confidence: 98,
        bbox: { x0: 280, y0: 95, x1: 440, y1: 123, width: 160, height: 28 }
      },
      {
        id: 'sample_msg_1',
        type: 'line',
        text: 'Please dispatch order immediately.',
        confidence: 97,
        bbox: { x0: 56, y0: 198, x1: 360, y1: 222, width: 304, height: 24 }
      },
      {
        id: 'sample_art_no',
        type: 'line',
        text: 'ART. No. 250',
        confidence: 99,
        bbox: { x0: 186, y0: 228, x1: 320, y1: 252, width: 134, height: 24 }
      },
      {
        id: 'sample_reply',
        type: 'line',
        text: 'Reply',
        confidence: 99,
        bbox: { x0: 56, y0: 265, x1: 136, y1: 295, width: 80, height: 30 }
      },
      {
        id: 'sample_timestamp_bubble',
        type: 'line',
        text: '10/02/2025, 3:08 pm',
        confidence: 98,
        bbox: { x0: 345, y0: 312, x1: 468, y1: 334, width: 123, height: 22 }
      }
    ]
  };
}

export function generateInvoiceSample() {
  const canvas = document.createElement('canvas');
  canvas.width = 680;
  canvas.height = 560;
  const ctx = canvas.getContext('2d');

  // Clean paper white background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Card container
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(30, 30, canvas.width - 60, canvas.height - 60, 12);
  ctx.fill();
  ctx.stroke();

  // Header
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('COMMERCIAL INVOICE', 60, 80);

  ctx.fillStyle = '#64748b';
  ctx.font = '500 14px sans-serif';
  ctx.fillText('Invoice #: INV-98421', 60, 110);
  ctx.fillText('Date: 12/04/2025', 60, 135);
  ctx.fillText('Due: 26/04/2025', 60, 160);

  // Bill To
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('Billed To: Global Tech Ltd', 380, 110);
  ctx.font = '400 14px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('77 Market Street, Suite 400', 380, 135);
  ctx.fillText('San Francisco, CA 94103', 380, 160);

  // Table header
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(60, 200, canvas.width - 120, 36);
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('DESCRIPTION', 75, 223);
  ctx.fillText('QTY', 360, 223);
  ctx.fillText('PRICE', 440, 223);
  ctx.fillText('TOTAL', 530, 223);

  // Row 1
  ctx.fillStyle = '#1e293b';
  ctx.font = '400 14px sans-serif';
  ctx.fillText('Cloud Hosting Subscription', 75, 270);
  ctx.fillText('1', 370, 270);
  ctx.fillText('$450.00', 440, 270);
  ctx.fillText('$450.00', 530, 270);

  // Row 2
  ctx.fillText('Database Managed Cluster', 75, 310);
  ctx.fillText('2', 370, 310);
  ctx.fillText('$180.00', 440, 310);
  ctx.fillText('$360.00', 530, 310);

  // Total
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(350, 360);
  ctx.lineTo(600, 360);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Balance Due: $810.00', 410, 400);

  // Status Badge
  ctx.fillStyle = '#ecfdf5';
  ctx.strokeStyle = '#a7f3d0';
  ctx.beginPath();
  ctx.roundRect(60, 440, 140, 36, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#059669';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('Status: PAID', 85, 463);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    presetElements: [
      {
        id: 'inv_title',
        type: 'line',
        text: 'COMMERCIAL INVOICE',
        confidence: 99,
        bbox: { x0: 58, y0: 58, x1: 340, y1: 85, width: 282, height: 27 }
      },
      {
        id: 'inv_num',
        type: 'line',
        text: 'Invoice #: INV-98421',
        confidence: 98,
        bbox: { x0: 58, y0: 95, x1: 220, y1: 115, width: 162, height: 20 }
      },
      {
        id: 'inv_date',
        type: 'line',
        text: 'Date: 12/04/2025',
        confidence: 99,
        bbox: { x0: 58, y0: 120, x1: 185, y1: 140, width: 127, height: 20 }
      },
      {
        id: 'inv_billed',
        type: 'line',
        text: 'Billed To: Global Tech Ltd',
        confidence: 97,
        bbox: { x0: 378, y0: 95, x1: 560, y1: 115, width: 182, height: 20 }
      },
      {
        id: 'inv_total',
        type: 'line',
        text: 'Balance Due: $810.00',
        confidence: 99,
        bbox: { x0: 408, y0: 382, x1: 610, y1: 406, width: 202, height: 24 }
      },
      {
        id: 'inv_status',
        type: 'line',
        text: 'Status: PAID',
        confidence: 99,
        bbox: { x0: 82, y0: 445, x1: 185, y1: 470, width: 103, height: 25 }
      }
    ]
  };
}
