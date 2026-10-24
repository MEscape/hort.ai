import { describe, expect, it } from 'vitest';

import { stripHtml } from '@lib/utils';
import { decodeHtmlEntities } from '@lib/utils/string';

describe('decodeHtmlEntities', () => {
  it('decodes named, decimal and hexadecimal entities', () => {
    expect(decodeHtmlEntities('W&uuml;rzburg &#x26; &amp; &#65; &#x41;')).toBe('Würzburg & & A A');
    expect(decodeHtmlEntities('&lt;b&gt; &quot;q&quot; &apos;')).toBe('<b> "q" \'');
    expect(decodeHtmlEntities('&Auml;&szlig;')).toBe('Äß');
  });

  it('decodes an emoji given as a code point', () => {
    expect(decodeHtmlEntities('&#x1F600;')).toBe('😀');
  });

  it('leaves an unknown name as written', () => {
    expect(decodeHtmlEntities('&unknown; &amp')).toBe('&unknown; &amp');
  });

  it('leaves a code point beyond U+10FFFF as written', () => {
    expect(decodeHtmlEntities('&#x110000; &#1114112;')).toBe('&#x110000; &#1114112;');
    expect(decodeHtmlEntities('&#x10FFFF;')).toBe('\u{10ffff}');
  });

  it('does not resolve names from the prototype chain', () => {
    expect(decodeHtmlEntities('&constructor; &toString; &__proto__;')).toBe(
      '&constructor; &toString; &__proto__;',
    );
  });

  it('does not decode twice', () => {
    expect(decodeHtmlEntities('&amp;lt;')).toBe('&lt;');
  });
});

describe('stripHtml', () => {
  it('removes tags, replacing them with spaces, and normalizes whitespace', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
    expect(stripHtml('a<br>b')).toBe('a b');
  });

  it('decodes entities after stripping', () => {
    expect(stripHtml('<p>Tom &amp; Jerry &lt;3</p>')).toBe('Tom & Jerry <3');
  });

  it('removes script and style content together with the tags, case-insensitively', () => {
    expect(stripHtml('a<script>alert(1)</script>b')).toBe('a b');
    expect(stripHtml('a<STYLE>p { color: red }</STYLE>b')).toBe('a b');
    expect(stripHtml('x<script type="text/javascript">1<2</SCRIPT>y')).toBe('x y');
  });

  it('keeps other elements content', () => {
    expect(stripHtml('<div>one</div><span>two</span>')).toBe('one two');
  });

  it('treats a < without a following > as text', () => {
    expect(stripHtml('1 < 2')).toBe('1 < 2');
    expect(stripHtml('<p>a</p> b < c')).toBe('a b < c');
  });

  it('drops the rest of the input after an unclosed script, once', () => {
    expect(stripHtml('a<script>x<script>y')).toBe('a x y');
    expect(stripHtml('a<script>x<b>y</b>')).toBe('a x y');
  });

  it('handles an unclosed style separately from a closed script', () => {
    expect(stripHtml('<script>1</script>a<style>x<style>y')).toBe('a x y');
  });

  it('is linear on a long run of < characters', () => {
    const started = performance.now();
    expect(stripHtml('<'.repeat(100_000))).toBe('<'.repeat(100_000));
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('returns an empty string for empty or tag-only input', () => {
    expect(stripHtml('')).toBe('');
    expect(stripHtml('<br><hr>')).toBe('');
  });
});
