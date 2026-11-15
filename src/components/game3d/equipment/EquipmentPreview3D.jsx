import { useEffect, useRef, useState } from 'react';
import PlayerAvatarPreview from '@/components/onboarding/PlayerAvatarPreview';
import CreatorStage from '@/components/onboarding/CreatorStage';
import { creatorBody } from '@/components/onboarding/avatarCustomization';
import { useGameAvatar } from '../useGameAvatar';

// Appearance and Character Services use the same inventory-owned appearance
// and the SAME fused-body renderer as the avatar creator. An offscreen service
// panel must not consume another WebGL context on a phone.
export default function EquipmentPreview3D() {
  const config = useGameAvatar();
  const body = creatorBody(config);
  const mount = useRef(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  const [loadError, setLoadError] = useState('');
  const modelWarnings=config.game3d_armor_visual_warnings||[];
  const visualError=loadError||modelWarnings.join(' · ');
  useEffect(() => {
    const host = mount.current;
    if (!host) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      setVisible(Boolean(entry?.isIntersecting && entry.intersectionRatio > 0));
    }, { threshold: 0.01, rootMargin: '40px' });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setLoadError(''); }, [config.model_url, config.creator_body]);

  return (
    <div ref={mount} data-game3d-armor-preview
      style={{position:'relative',width:'100%',height:'100%',minHeight:0}}>
      {visible && (body
        ? <CreatorStage key={body.id} config={config} shot="body" livingIdle={false}
            onCustomizationState={(state) => setLoadError(state?.error || '')} />
        : <PlayerAvatarPreview config={config}
            modelUrlOverride={config.model_url} orbit controls="compact" />)}
      {visible && visualError && (
        <div role="status" style={{
          position:'absolute',bottom:8,left:8,right:8,padding:7,
          borderRadius:6,background:'rgba(20,27,36,.90)',color:'#ffd9aa',
          fontSize:11,textAlign:'center',pointerEvents:'none',
        }}>Equipped armor visuals: {visualError}</div>
      )}
    </div>
  );
}
