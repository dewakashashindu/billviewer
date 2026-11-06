'use client';
import {createContext} from 'react';
/** Visibility controls only; data authorization must also be enforced server-side. */
export const ReportPermissionsContext = createContext<string[]>([]);
