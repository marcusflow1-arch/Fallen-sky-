import {useSyncExternalStore} from 'react';
import {getActiveCharacter,subscribeCharacters} from './characterStore';
import {useCompanionIdentity} from '@/components/onboarding/CompanionIdentityContext';
import {playerAppearance} from '@/components/onboarding/playerAppearance';
import {game3dCharacterModel} from './game3dCharacterModel';
import {useArmoredAppearance} from './armor/armorEquipBridge';
export function useGameAvatar(){
 const character=useSyncExternalStore(subscribeCharacters,getActiveCharacter),saved=useCompanionIdentity();
 const localCharacter=character&&!character.isDevTest?character:null;
 const appearance=playerAppearance(localCharacter||saved);
 // playerAppearance intentionally pins the platform avatar to v5. Only Game 3D
 // opts into the selected local creator body for actual world rendering.
 // Readiness compares the requested body for every roster slot, including
 // Dev Test. Leaving its model URL undefined made Enter World wait forever.
 return useArmoredAppearance({...appearance,model_url:game3dCharacterModel(localCharacter||appearance)},character?.id);
}