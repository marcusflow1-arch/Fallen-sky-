import { Component, Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getAXEServiceGroup } from './AXEServiceGroups.js';
import { getAXEService } from './AXEServiceRegistry';
import { setAXEStationPreview, setAXEStationPreviewRotation, playAXEStationTransaction,
  getAXEServiceStationSnapshot } from './world/AXEServiceStationStore.js';
import {verifiedQuestbookReader170} from '../quests/AXEQuestbookRemoteReader170';
import './AXEServiceWorkspace.css';

const EquipmentPanel = lazy(() => import('./AXEGlobalServicesMenu').then(module => ({ default: module.EquipmentServicePanel })));
const ProgressionPanel = lazy(() => import('./AXEGlobalServicesMenu').then(module => ({ default: module.AXEProgressionServicePanel })));
const BlacksmithImageWorkspace = lazy(() => import('./AXEBlacksmithImageWorkspace'));
const SpiritualWorkspace = lazy(() => import('./AXESpiritualWorkspace'));
const CompanionWorkspace = lazy(() => import('./AXECompanionWorkspace'));
const AppearanceWorkspace = lazy(() => import('./AXEAppearanceWorkspace'));
const SkillBookWorkspace = lazy(() => import('./AXESkillBookWorkspace'));
const QuestLogbookWorkspace = lazy(() => import('./AXEQuestLogbookWorkspace'));



class WorkspaceBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error, info) {
    // Keep the operation navigation mounted if a specific progression panel
    // fails; previously closing the entire service made every button look dead.
    console.error('[Game3D Services] Panel failed:', error, info?.componentStack);
  }
  render() {
    if (this.state.failed) return <div className="axe-service-error" role="alert">
      This service panel could not load. Choose another operation above, or retry.
      <button type="button" onClick={() => this.setState({ failed: false })}>Retry panel</button>
      <button type="button" onClick={this.props.onClose}>Close service</button>
    </div>;
    return this.props.children;
  }
}

export default function AXEServiceWorkspace({ mode, onClose }) {
  const group = getAXEServiceGroup(mode.groupId);
  const root = useRef(null);
  const [mobilePane, setMobilePane] = useState('inventory');
  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    const previous = document.activeElement;
    root.current?.querySelector('[data-service-close]')?.focus();
    return () => { if (previous?.isConnected) previous.focus?.({ preventScroll: true }); };
  }, [mode.groupId]);
  useLayoutEffect(() => { setMobilePane('inventory'); setRotation(0); setAXEStationPreview(null); }, [mode.groupId]);
  if (!group) return null;
  const world = group.presentation === 'world' && !mode.uiOnly;
  const rotate = change => {
    const next = rotation + change;
    setRotation(next);
    setAXEStationPreviewRotation(next);
  };
  return (
    <section ref={root} className={`axe-service-workspace ${world ? 'axe-service-workspace--world' : 'axe-service-workspace--panel'} ${group.id === 'blacksmith' ? 'axe-service-workspace--blacksmith' : group.id === 'spiritual' ? 'axe-service-workspace--spiritual' : group.id === 'companion' ? 'axe-service-workspace--companion' : group.id === 'appearance' ? 'axe-service-workspace--appearance' : group.id === 'character' ? 'axe-service-workspace--character axe-service-workspace--appearance' : group.id === 'skills' ? 'axe-service-workspace--skills' : group.id === 'quest_logbook' ? 'axe-service-workspace--quest-logbook' : ''}`}
      data-service-ui="true" data-service-extent="viewport-top" data-mobile-pane={mobilePane} aria-label={`${group.label} workspace`}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        // Service fields and shortcuts never bubble into window gameplay listeners.
        event.stopPropagation();
      }} onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}
      onWheel={event => event.stopPropagation()}>
      {group.id !== 'blacksmith' && group.id !== 'skills' && group.id !== 'quest_logbook' && group.id !== 'character' && <header className="axe-service-heading">
        <div><span className="axe-service-kicker">{world ? (mode.shared ? 'Shared workstation' : 'Personal workstation') : 'Services'}</span>
          <h1>{group.label}</h1></div>
        <div className="axe-service-header-actions">
          <button type="button" data-service-close onClick={onClose}>Close <span aria-hidden="true">×</span></button>
        </div>
      </header>}
      <nav className="axe-service-operations" aria-label={`${group.label} operations`}>
        {group.serviceIds.map(id => <button type="button" key={id}
          aria-pressed={mode.serviceId === id} onClick={() => mode.controller.selectOperation(id)}>
          {getAXEService(id)?.label || id}</button>)}
      </nav>
      <p className="axe-service-operation-help" role="note">
        {getAXEService(mode.serviceId)?.description || 'Choose an operation to see its requirements and effects.'}
      </p>
      {group.serviceIds.length > 1 && <label className="axe-service-operation-select">Operation
        <select aria-label={`${group.label} operation`} value={mode.serviceId}
          onChange={event => mode.controller.selectOperation(event.target.value)}>
          {group.serviceIds.map(id => <option value={id} key={id}>{getAXEService(id)?.label || id}</option>)}
        </select>
      </label>}
      {mode.message && group.id !== 'blacksmith' && group.id !== 'appearance' && group.id !== 'character' && group.id !== 'skills' && group.id !== 'quest_logbook' &&
        <p className="axe-service-notice" role="status">{mode.message}</p>}
      {mode.phase === 'loading' ? <p className="axe-service-loading" role="status">Finding a safe workstation location…</p> : (
        <WorkspaceBoundary key={group.id === 'blacksmith' ? mode.groupId : `${mode.groupId}:${mode.serviceId}`} onClose={onClose}>
          <Suspense fallback={<p className="axe-service-loading" role="status">Opening {group.label}…</p>}>
            {group.id === 'companion' ? <div className="axe-service-progression">
              <CompanionWorkspace onClose={onClose} serviceId={mode.serviceId} />
            </div> : group.id === 'spiritual' ? <div className="axe-service-progression">
              <SpiritualWorkspace serviceId={mode.serviceId}
                onSelect={mode.controller.selectOperation} onClose={onClose} />
            </div> : group.id === 'skills' ? <div className="axe-service-progression">
              <SkillBookWorkspace serviceId={mode.serviceId}
                onSelect={mode.controller.selectOperation} onClose={onClose} />
            </div> : group.id === 'quest_logbook' ? <div className="axe-service-progression">
              <QuestLogbookWorkspace onClose={onClose} verifiedQuestbookReader={verifiedQuestbookReader170} />
            </div> : group.id === 'character' ? <div className="axe-service-progression">
              <AppearanceWorkspace serviceId={mode.serviceId} stationMessage={mode.message} onClose={onClose} />
            </div> : group.id === 'blacksmith' ? <>
              <nav className="axe-service-mobile-panes" aria-label="Workspace panels">
                <button type="button" aria-pressed={mobilePane === 'inventory'} onClick={() => setMobilePane('inventory')}>Inventory</button>
                <button type="button" aria-pressed={mobilePane === 'controls'} onClick={() => setMobilePane('controls')}>Upgrade controls</button>
              </nav>
              <BlacksmithImageWorkspace mode={mode} onClose={onClose} stationMessage={mode.message}
                EquipmentPanel={EquipmentPanel} ProgressionPanel={ProgressionPanel}
                onSelectedItem={() => { setRotation(0); setAXEStationPreview(null); }}
                onTransaction={result => {
                  if (mode.stationId && getAXEServiceStationSnapshot().activeStationId === mode.stationId) playAXEStationTransaction(result);
                }} />
              {world && <div className="axe-service-inspection" aria-label="Item inspection controls">
                <span>Selected equipment is inspected at the anvil</span>
                <div><button type="button" onClick={() => rotate(-Math.PI / 6)} aria-label="Rotate item left">Rotate left</button>
                  <button type="button" onClick={() => rotate(Math.PI / 6)} aria-label="Rotate item right">Rotate right</button></div>
              </div>}
            </> : <div className="axe-service-progression">
              <ProgressionPanel key={mode.serviceId} serviceId={mode.serviceId} />
            </div>}
          </Suspense>
        </WorkspaceBoundary>
      )}
    </section>
  );
}
