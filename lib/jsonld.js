// U+2028/U+2029 end a line inside a <script> in older parsers; built from
// char codes so this file holds no invisible characters.
const LS = new RegExp(String.fromCharCode(0x2028), 'g');
const PS = new RegExp(String.fromCharCode(0x2029), 'g');

/**
 * Serialize structured data for a <script type="application/ld+json"> tag.
 *
 * The values come from the merchant's saved content (name, copy, product
 * text). JSON.stringify alone does not stop "</script>" inside a string from
 * closing the tag early and turning the rest into markup, so the characters
 * that can do that are escaped as JSON unicode escapes - still the same data
 * to a search engine, inert to the HTML parser.
 */
export function jsonLd(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LS, '\\u2028')
    .replace(PS, '\\u2029');
}
