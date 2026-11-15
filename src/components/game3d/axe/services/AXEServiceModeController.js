import { getAXEServiceGroup } from './AXEServiceGroups.js';

const initial = () => ({ phase: 'closed', expanded: false, groupId: null, serviceId: null,
  itemId: null, stationId: null, shared: false, uiOnly: false, message: '' });

// UI session ownership is independent of the station's world lifetime and finances.
// An old async summon can finish after Close or a newer service selection.
export function createAXEServiceModeController({ summon, enter, leave, canOpen = () => null }) {
  let state = initial();
  let generation = 0;
  let disposed = false;
  const listeners = new Set();
  const publish = (next) => {
    if (disposed) return;
    state = { ...state, ...next };
    listeners.forEach(fn => fn());
  };
  const release = (id) => {
    if (!id) return;
    try { Promise.resolve(leave(id)).catch(() => {}); } catch { /* UI recovery must always finish. */ }
  };
  return {
    getSnapshot: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    toggle() {
      if (state.groupId) return;
      publish({ expanded: !state.expanded, phase: state.expanded ? 'closed' : 'expanded', message: '' });
    },
    selectOperation(serviceId) {
      if (!getAXEServiceGroup(state.groupId)?.serviceIds.includes(serviceId)) return;
      publish({ serviceId });
    },
    async open(groupId, { serviceId, itemId = null, stationId = null } = {}) {
      const group = getAXEServiceGroup(groupId);
      if (!group || disposed) return;
      const denial = canOpen(group.id);
      if (denial) { publish({ message: denial }); return; }
      const token = ++generation;
      release(state.stationId);
      // All six services have real inventory/progression panels. Display the
      // controls immediately; a physical workstation is an enhancement, not a
      // prerequisite that may block the entire service if world loading stalls.
      const needsStation = group.presentation === 'world';
      publish({ phase: 'active', expanded: true, groupId:group.id, serviceId: group.serviceIds.includes(serviceId)
        ? serviceId : group.defaultServiceId, itemId, stationId: null, shared: false,
        uiOnly: true, message: needsStation ? 'Preparing the 3D workstation… You can use these controls now.' : '' });
      if (!needsStation) return;
      let result;
      try { result = await (stationId ? enter(stationId) : summon(group.id)); }
      catch (error) { result = { ok: false, reason: error?.message || 'Workstation unavailable' }; }
      if (disposed || token !== generation) {
        // Never release the current session when two requests reused the same station.
        if (result?.station?.id !== state.stationId) release(result?.station?.id);
        return;
      }
      const deniedAfterLoad = canOpen(group.id);
      if (deniedAfterLoad) {
        release(result?.station?.id);
        this.close(deniedAfterLoad);
        return;
      }
      if (!result?.ok && /COMBAT|DUNGEON|DEAD|DYING|BUSY|DISALLOWED|PROHIBITED|SERVICE_UNAVAILABLE_HERE/.test(result?.reason || '')) {
        this.close(String(result.reason).replaceAll('_', ' '));
        return;
      }
      if (result?.ok && result.station?.groupId && result.station.groupId !== group.id) {
        release(result.station.id);
        publish({ phase: 'active', stationId: null, shared: false, uiOnly: true,
          message: 'The world returned a different workstation. The service controls remain available.' });
        return;
      }
      publish({ phase: 'active', stationId: result?.ok ? result.station?.id : null,
        shared: !!result?.shared, uiOnly: !result?.ok,
        message: result?.ok ? (result.message || '') : result?.reason === 'APPROACH_EXISTING_STATION'
          ? `A nearby ${group.label} is available at ${Math.round(result.station.position.x)}, ${Math.round(result.station.position.z)}. Approach it and press E to use it, or use the controls here.`
          : `${String(result?.reason || 'No safe workstation location is available.').replaceAll('_', ' ')} Use the service controls here, or close and try another location.` });
    },
    close(message = '') {
      ++generation;
      release(state.stationId);
      publish({ ...initial(), expanded: state.expanded, phase: state.expanded ? 'expanded' : 'closed', message });
    },
    dispose() {
      ++generation;
      release(state.stationId);
      disposed = true;
      listeners.clear();
    },
  };
}
