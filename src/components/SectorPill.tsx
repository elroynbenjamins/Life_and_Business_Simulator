import React from 'react';
import { Colors } from '../theme/colors';
import StatusPill from './StatusPill';

interface Props {
  sector: string;
}

export default function SectorPill({ sector }: Props) {
  const color = Colors.sectorColors?.[sector] ?? Colors.textMuted;
  return <StatusPill label={sector} color={color} />;
}
