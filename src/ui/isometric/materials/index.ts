import { extend } from '@react-three/fiber';
import { LatticeMaterial } from './LatticeMaterial.js';
import { RiskMaterial } from './RiskMaterial.js';

/**
 * [Registry] Material Registry
 * Centralized extend calls for all custom R3F materials.
 * Importing this file triggers the side-effect.
 */
export function registerMaterials() {
    console.log('[R3F] Registering Custom Materials...');

    const registrations: any = { LatticeMaterial };
    if (RiskMaterial) {
        registrations.RiskMaterial = RiskMaterial;
    }

    extend(registrations);
}

// Automatic side-effect on import
registerMaterials();
