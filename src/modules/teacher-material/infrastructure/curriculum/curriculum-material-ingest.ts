import { curriculumText } from '@modules/curriculum';

import type { MaterialIngest } from '../../domain/ports/material-services.port';

/** The same bounded, cleaned untrusted-data extractor as official curriculum (#28). */
export const curriculumMaterialIngest: MaterialIngest = {
  extract: (text) => curriculumText.extractStatements(text),
};
