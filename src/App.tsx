/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { EstadoCRM } from './types';
import { crmRepo } from './repo';
import { Header } from './components/Header';
import { Navigation, TabActiva } from './components/Navigation';
import { TableroView } from './components/Tablero/TableroView';
import { PanelView } from './components/Panel/PanelView';
import { ProspectarView } from './components/Prospectar/ProspectarView';
import { ClienteIdealView } from './components/ClienteIdeal/ClienteIdealView';
import { LogrosView } from './components/Logros/LogrosView';
import { GuiaView } from './components/Guia/GuiaView';
import { FichaLateral } from './components/FichaLateral';
import { ModalNuevoLead } from './components/ModalNuevoLead';
import { ModalImportarCopia } from './components/ModalImportarCopia';
import { NotificationToast } from './components/common/NotificationToast';
import { comprobarYNotificarVencimientos } from './utils/browserNotifications';

export default function App() {
  const [estado, setEstado] = useState<EstadoCRM>(crmRepo.obtenerEstado());
  const [tabActiva, setTabActiva] = useState<TabActiva>('tablero');
  const [fichaOpId, setFichaOpId] = useState<string | null>(null);
  const [modalNuevoLeadAbierto, setModalNuevoLeadAbierto] = useState(false);
  const [modalImportarAbierto, setModalImportarAbierto] = useState(false);

  const estadoRef = React.useRef(estado);
  estadoRef.current = estado;

  // Suscripción al repositorio reactivo único
  useEffect(() => {
    const unsub = crmRepo.suscribir((nuevoEstado) => {
      setEstado(nuevoEstado);
    });
    return unsub;
  }, []);

  // Vigilante de notificaciones del navegador en segundo plano
  useEffect(() => {
    // Al hacer clic en una notificación del navegador, abrir la ficha correspondiente
    const handleAbrirOpDesdeNotif = (e: any) => {
      if (e.detail?.opId) {
        setFichaOpId(e.detail.opId);
      }
    };
    window.addEventListener('eonesia:abrir-oportunidad', handleAbrirOpDesdeNotif);

    // Cuando la pestaña pasa a segundo plano (oculta), comprobar vencimientos de inmediato
    const handleVisibilityChange = () => {
      if (document.hidden) {
        comprobarYNotificarVencimientos(estadoRef.current, true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Comprobación periódica en segundo plano cada 45 segundos
    const timer = setInterval(() => {
      comprobarYNotificarVencimientos(estadoRef.current, true);
    }, 45000);

    return () => {
      window.removeEventListener('eonesia:abrir-oportunidad', handleAbrirOpDesdeNotif);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(timer);
    };
  }, []);

  const conteoAbiertas = estado.oportunidades.filter(
    (o) => o.etapa !== 'Ganado' && o.etapa !== 'Perdido'
  ).length;

  return (
    <div className="min-h-screen bg-[#000000] text-[#F2F2F7] flex flex-col md:flex-row antialiased selection:bg-[#00C8FF]/30 selection:text-[#F2F2F7]">
      {/* 1. NAVEGACIÓN: Barra Lateral en Desktop (>= 768px) o Barra Inferior en Móvil (< 768px) */}
      <Navigation
        tabActiva={tabActiva}
        onCambiarTab={setTabActiva}
        conteoAbiertas={conteoAbiertas}
      />

      {/* 2. ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-20 md:pb-6">
        {/* Cabecera con Insignia de Nivel, Barra XP, Misiones de hoy y acciones rápidas */}
        <Header
          estado={estado}
          onAbrirNuevoLead={() => setModalNuevoLeadAbierto(true)}
          onAbrirImportar={() => setModalImportarAbierto(true)}
        />

        {/* Contenido de la Pantalla Activa */}
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {tabActiva === 'tablero' && (
            <TableroView
              estado={estado}
              onAbrirFicha={(opId) => setFichaOpId(opId)}
            />
          )}

          {tabActiva === 'panel' && (
            <PanelView
              estado={estado}
              onAbrirFicha={(opId) => setFichaOpId(opId)}
            />
          )}

          {tabActiva === 'prospectar' && (
            <ProspectarView
              estado={estado}
              onAbrirFicha={(opId) => setFichaOpId(opId)}
            />
          )}

          {tabActiva === 'cliente_ideal' && (
            <ClienteIdealView estado={estado} />
          )}

          {tabLogrosRender(tabActiva, estado)}

          {tabActiva === 'guia' && <GuiaView />}
        </main>
      </div>

      {/* 3. FICHA LATERAL (DRAWER / MODAL COMPLETO EN MÓVIL) */}
      {fichaOpId && (
        <FichaLateral
          oportunidadId={fichaOpId}
          estado={estado}
          onCerrar={() => setFichaOpId(null)}
        />
      )}

      {/* 4. MODAL NUEVO LEAD */}
      <ModalNuevoLead
        abierto={modalNuevoLeadAbierto}
        estado={estado}
        onCerrar={() => setModalNuevoLeadAbierto(false)}
        onLeadCreado={(opId) => setFichaOpId(opId)}
      />

      {/* 5. MODAL IMPORTAR COPIA */}
      <ModalImportarCopia
        abierto={modalImportarAbierto}
        onCerrar={() => setModalImportarAbierto(false)}
      />

      {/* 6. NOTIFICACIONES TOAST (XP, NIVELES, INSIGNIAS) */}
      <NotificationToast />
    </div>
  );
}

function tabLogrosRender(tabActiva: TabActiva, estado: EstadoCRM) {
  if (tabActiva === 'logros') {
    return <LogrosView estado={estado} />;
  }
  return null;
}
