import { isBlank } from '@lib/utils';

import { MATERIAL_WORD_CONTENT_TYPE } from '../../domain/models/material';

import { slidesText, wordText } from './office-xml-text';
import { ZipArchive } from './zip-archive';

import type { MaterialDocumentConverter } from '../../domain/ports/material-services.port';

/**
 * Reads the text of a Word (.docx) or PowerPoint (.pptx) file. Anything that is not such a file,
 * is damaged, encrypted or larger than the archive limits yields `null`; the cause is not
 * reported because the bytes come from outside and are never trusted.
 */
export const officeMaterialConverter: MaterialDocumentConverter = {
  toText: (contentType, bytes) => {
    const zip = ZipArchive.open(bytes);
    if (zip === null) {
      return null;
    }
    const text = contentType === MATERIAL_WORD_CONTENT_TYPE ? wordText(zip) : slidesText(zip);
    return text === null || isBlank(text) ? null : text;
  },
};
