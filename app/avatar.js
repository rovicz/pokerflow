'use client';
import {Avatar as DiceAvatar, Style} from '@dicebear/core';
import lorelei from '@dicebear/styles/lorelei.json';
import adventurer from '@dicebear/styles/adventurer.json';
import bottts from '@dicebear/styles/bottts.json';
import pixelArt from '@dicebear/styles/pixel-art.json';
import funEmoji from '@dicebear/styles/fun-emoji.json';
import notionists from '@dicebear/styles/notionists.json';
import {cleanAvatar} from '../lib/avatars.mjs';

const DEF = {lorelei, adventurer, bottts, 'pixel-art': pixelArt, 'fun-emoji': funEmoji, notionists};
const styles = {}, cache = new Map();
const uri = a => {
  const k = a.style + '/' + a.seed;
  if (!cache.has(k)) cache.set(k, new DiceAvatar(styles[a.style] ??= new Style(DEF[a.style]), {seed: a.seed, size: 96}).toDataUri());
  return cache.get(k);
};

export default function Avatar({a, name, size = 28}) {
  const v = cleanAvatar(a, name);
  return <img className="avatar" src={uri(v)} alt="" width={size} height={size}/>;
}
