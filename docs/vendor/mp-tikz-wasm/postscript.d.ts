/**
 * postscript.ts — which PostScript a DVI file asks for, and what is lost when
 * dvisvgm cannot run it.
 *
 * dvisvgm interprets PostScript specials only through Ghostscript, which this
 * build does not include, so it skips them ("N PostScript specials ignored").
 * Almost every LaTeX document has some that do not matter for the drawing: the
 * l3 kernel's `header=l3backend-dvips.pro`, PGF's `ps::%%…BoundingBox`
 * comments, hyperref's link and metadata pdfmarks. Others carry the drawing
 * itself: EPS and PDF images (`psfile=`, `pdffile=`), graphicx's rotation and
 * scaling under its default dvips driver, PSTricks, raw `\special{ps: …}`. Only
 * those are worth a warning, so the specials are read from the DVI and sorted.
 */
/** Every special (`xxx1`–`xxx4`) in a DVI file, in order. The opcodes are
 *  walked rather than the bytes searched, since typeset text is raw bytes too. */
export declare function dviSpecials(b: Uint8Array): string[];
export type LostPostScript = 'image' | 'transform' | 'pstricks' | 'other';
/** What a PostScript special draws, or null when skipping it loses nothing visible. */
export declare function classifyPostScript(s: string): LostPostScript | null;
/** A one-line account of what the SVG is missing, or null when nothing visible was lost. */
export declare function describeLostPostScript(specials: string[]): string | null;
