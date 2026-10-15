/**
 * US state / territory / military codes the shipping address accepts.
 *
 * A dropdown rather than free text: "ZZZZZ" was accepted as a state, saved to
 * the order, and would have gone to the tax and shipping calculation as-is
 * (support #214).
 */
export const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
  ['AS', 'American Samoa'], ['GU', 'Guam'], ['MP', 'Northern Mariana Islands'], ['PR', 'Puerto Rico'],
  ['VI', 'U.S. Virgin Islands'], ['AA', 'Armed Forces Americas'], ['AE', 'Armed Forces Europe'],
  ['AP', 'Armed Forces Pacific'],
];

const CODES = new Set(US_STATES.map(([code]) => code));
const BY_NAME = new Map(US_STATES.map(([code, name]) => [name.toLowerCase(), code]));

/**
 * Normalize whatever is stored ("il", "Illinois", " IL ") to a valid 2-letter
 * code, or '' when it is not one — so an old free-text address shows an empty
 * dropdown the shopper must fix instead of silently passing bad data on.
 */
export function normalizeState(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const upper = v.toUpperCase();
  if (CODES.has(upper)) return upper;
  return BY_NAME.get(v.toLowerCase()) || '';
}

export const isStateCode = (v) => CODES.has(String(v || ''));
