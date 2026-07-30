import jsPDF from 'jspdf';
import type { Load } from '@freightx/shared';

export interface RateConParams {
  load: Load;
  carrierName: string;
  carrierMC?: string;
  brokerName: string;
  brokerContact?: string;
}

export function generateRateCon(params: RateConParams): void {
  const { load, carrierName, carrierMC, brokerName, brokerContact } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  const W = doc.internal.pageSize.getWidth();
  const orange = [232, 96, 48] as const;
  const dark = [20, 20, 20] as const;
  const gray = [120, 120, 120] as const;
  const light = [240, 240, 240] as const;

  // ── Header bar ──────────────────────────────────────────
  doc.setFillColor(...orange);
  doc.rect(0, 0, W, 56, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('FreightX', 40, 36);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('RATE CONFIRMATION', W - 40, 36, { align: 'right' });

  // ── Sub-header ──────────────────────────────────────────
  doc.setFillColor(...light);
  doc.rect(0, 56, W, 36, 'F');

  doc.setTextColor(...gray);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`LOAD #  ${load.loadNumber}`, 40, 79);
  doc.text(
    `DATE: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    W - 40,
    79,
    { align: 'right' },
  );

  // ── Section helper ───────────────────────────────────────
  let y = 115;
  function section(title: string) {
    doc.setFillColor(...orange);
    doc.rect(40, y, W - 80, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 48, y + 14);
    y += 28;
  }

  function row(label: string, value: string, indent = 40) {
    doc.setTextColor(...gray);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(label, indent, y);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text(value, indent + 130, y);
    y += 18;
  }

  // ── Route ────────────────────────────────────────────────
  section('SHIPMENT DETAILS');
  row('Origin:', `${load.originCity}, ${load.originState}`);
  row('Destination:', `${load.destCity}, ${load.destState}`);
  row(
    'Pickup Date:',
    new Date(load.pickupDate + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  );
  row(
    'Delivery Date:',
    load.deliveryDate
      ? new Date(load.deliveryDate + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'TBD',
  );
  if (load.totalMiles) row('Miles:', `${load.totalMiles.toLocaleString()} mi`);
  y += 8;

  // ── Freight ───────────────────────────────────────────────
  section('FREIGHT INFORMATION');
  row('Equipment:', load.equipment.replace('_', ' ').toUpperCase());
  row('Commodity:', load.commodity);
  row('Weight:', `${(load.weightLbs / 1000).toFixed(1)}k lbs`);
  if (load.hazmat) row('HAZMAT:', 'YES — Special handling required');
  if (load.tempControlled) row('Temp Control:', 'YES');
  y += 8;

  // ── Rate ─────────────────────────────────────────────────
  section('RATE DETAILS');
  row('Total Rate:', `$${load.rateUsd.toLocaleString()}`);
  if (load.ratePerMile) row('Rate per Mile:', `$${load.ratePerMile.toFixed(2)}/mi`);
  y += 8;

  // ── Parties ──────────────────────────────────────────────
  section('PARTIES');
  row('Broker:', brokerName);
  if (brokerContact) row('Broker Contact:', brokerContact);
  row('Carrier:', carrierName);
  if (carrierMC) row('MC Number:', carrierMC);
  y += 8;

  // ── Terms box ────────────────────────────────────────────
  section('TERMS & CONDITIONS');
  doc.setFillColor(252, 252, 252);
  doc.setDrawColor(...light);
  doc.rect(40, y, W - 80, 60, 'FD');
  doc.setTextColor(...gray);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  const terms = [
    '1. Carrier agrees to transport the freight described above at the rate stated.',
    '2. Payment terms: Net 30 days from delivery of signed POD.',
    '3. Carrier is responsible for cargo loss/damage per standard liability.',
    '4. This rate confirmation is the complete agreement between the parties.',
  ];
  terms.forEach((t, i) => {
    doc.text(t, 48, y + 14 + i * 12);
  });
  y += 76;

  // ── Signature lines ──────────────────────────────────────
  y += 16;
  const colW = (W - 80) / 2 - 10;
  doc.setDrawColor(...gray);
  doc.line(40, y, 40 + colW, y);
  doc.line(W / 2 + 10, y, W - 40, y);

  doc.setTextColor(...gray);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Broker Signature / Date', 40, y + 12);
  doc.text('Carrier Signature / Date', W / 2 + 10, y + 12);

  // ── Footer ───────────────────────────────────────────────
  doc.setFillColor(...orange);
  doc.rect(0, doc.internal.pageSize.getHeight() - 28, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(
    'Generated by FreightX  ·  freightx.app',
    W / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' },
  );

  // ── Save ─────────────────────────────────────────────────
  doc.save(`RateCon-${load.loadNumber}.pdf`);
}

/**
 * Same layout as generateRateCon but returns a Blob for storage upload
 * instead of triggering a browser download.
 */
export function generateRateConBlob(params: RateConParams): Blob {
  const { load, carrierName, carrierMC, brokerName, brokerContact } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  const W = doc.internal.pageSize.getWidth();
  const orange = [232, 96, 48] as const;
  const dark = [20, 20, 20] as const;
  const gray = [120, 120, 120] as const;
  const light = [240, 240, 240] as const;

  doc.setFillColor(...orange);
  doc.rect(0, 0, W, 56, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('FreightX', 40, 36);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('RATE CONFIRMATION', W - 40, 36, { align: 'right' });

  doc.setFillColor(...light);
  doc.rect(0, 56, W, 36, 'F');
  doc.setTextColor(...gray);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`LOAD #  ${load.loadNumber}`, 40, 79);
  doc.text(
    `DATE: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    W - 40,
    79,
    { align: 'right' },
  );

  let y = 115;
  function section(title: string) {
    doc.setFillColor(...orange);
    doc.rect(40, y, W - 80, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 48, y + 14);
    y += 28;
  }
  function row(label: string, value: string, indent = 40) {
    doc.setTextColor(...gray);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(label, indent, y);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text(value, indent + 130, y);
    y += 18;
  }

  section('SHIPMENT DETAILS');
  row('Origin:', `${load.originCity}, ${load.originState}`);
  row('Destination:', `${load.destCity}, ${load.destState}`);
  row(
    'Pickup Date:',
    new Date(load.pickupDate + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  );
  row(
    'Delivery Date:',
    load.deliveryDate
      ? new Date(load.deliveryDate + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'TBD',
  );
  if (load.totalMiles) row('Miles:', `${load.totalMiles.toLocaleString()} mi`);
  y += 8;

  section('FREIGHT INFORMATION');
  row('Equipment:', load.equipment.replace('_', ' ').toUpperCase());
  row('Commodity:', load.commodity);
  row('Weight:', `${(load.weightLbs / 1000).toFixed(1)}k lbs`);
  if (load.hazmat) row('HAZMAT:', 'YES — Special handling required');
  if (load.tempControlled) row('Temp Control:', 'YES');
  y += 8;

  section('RATE DETAILS');
  row('Total Rate:', `$${load.rateUsd.toLocaleString()}`);
  if (load.ratePerMile) row('Rate per Mile:', `$${load.ratePerMile.toFixed(2)}/mi`);
  y += 8;

  section('PARTIES');
  row('Broker:', brokerName);
  if (brokerContact) row('Broker Contact:', brokerContact);
  row('Carrier:', carrierName);
  if (carrierMC) row('MC Number:', carrierMC);
  y += 8;

  section('TERMS & CONDITIONS');
  doc.setFillColor(252, 252, 252);
  doc.setDrawColor(...light);
  doc.rect(40, y, W - 80, 60, 'FD');
  doc.setTextColor(...gray);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  const terms = [
    '1. Carrier agrees to transport the freight described above at the rate stated.',
    '2. Payment terms: Net 30 days from delivery of signed POD.',
    '3. Carrier is responsible for cargo loss/damage per standard liability.',
    '4. This rate confirmation is the complete agreement between the parties.',
  ];
  terms.forEach((t, i) => {
    doc.text(t, 48, y + 14 + i * 12);
  });
  y += 76;

  y += 16;
  const colW = (W - 80) / 2 - 10;
  doc.setDrawColor(...gray);
  doc.line(40, y, 40 + colW, y);
  doc.line(W / 2 + 10, y, W - 40, y);
  doc.setTextColor(...gray);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Broker Signature / Date', 40, y + 12);
  doc.text('Carrier Signature / Date', W / 2 + 10, y + 12);

  doc.setFillColor(...orange);
  doc.rect(0, doc.internal.pageSize.getHeight() - 28, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(
    'Generated by FreightX  ·  freightx.app',
    W / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' },
  );

  return new Blob([doc.output('arraybuffer') as ArrayBuffer], { type: 'application/pdf' });
}
