import { useId, useRef, useState, type MouseEvent } from 'react';
import { Eye, MessageCircle, Pencil, Settings, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { BookCover } from '@/components/reading-journal/BookCover';
import { HomeShell, type CreateDestination, type HomeDestination } from './HomeShell';
import './redesign.css';
import './profile-preview.css';

export const favoriteKinds = ['genre', 'author', 'series', 'book'] as const;
export type FavoriteKind = typeof favoriteKinds[number];
export interface ProfileChoice { id: string; name: string; detail?: string; cover?: string }
/** Explicit choices only. This preview model is not a database or visibility contract. */
export interface ProfilePreviewData {
  name: string;
  bio: string;
  favorites: Partial<Record<FavoriteKind, ProfileChoice>>;
}
export interface ProfilePreviewProps {
  profile: ProfilePreviewData;
  catalog: Record<FavoriteKind, ProfileChoice[]>;
  mode?: 'owner' | 'visitor';
  firstLogin?: boolean;
  currentlyReading?: ProfileChoice;
  achievement?: string;
  onSave: (profile: ProfilePreviewData) => Promise<void>;
  onSettings: () => void;
  onMessage: () => void;
  onOpenBook: (id: string) => void;
  onNavigate: (destination: HomeDestination) => void;
  onCreate: (destination: CreateDestination) => void;
  onNotifications: () => void;
}
const favoriteLabels: Record<FavoriteKind, string> = { genre: 'Favorite genre', author: 'Favorite author', series: 'Favorite series', book: 'Favorite book' };

function Identity({ profile }: { profile: ProfilePreviewData }) {
  const initials = profile.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('');
  return <div className="rj-profile-identity"><div className="rj-profile-avatar" aria-hidden="true">{initials || '?'}</div><div><p className="rj-profile-kicker">A life in books</p><h2>{profile.name}</h2>{profile.bio && <p className="rj-profile-bio">{profile.bio}</p>}</div></div>;
}

function Favorites({ profile, owner = false }: { profile: ProfilePreviewData; owner?: boolean }) {
  const visibleKinds = favoriteKinds.filter(kind => owner || profile.favorites[kind]);
  if (!visibleKinds.length) return null;
  return <section className="rj-profile-favorites" aria-label="Reading favorites"><h2>Reading favorites</h2><p className="rj-profile-intro">The stories and voices that feel like you.</p><dl className="rj-profile-favorite-grid">{visibleKinds.map(kind => {
    const choice = profile.favorites[kind];
    return <div key={kind} className="rj-profile-favorite" data-kind={kind}><dt>{favoriteLabels[kind]}</dt><dd><div>{choice ? <><strong>{choice.name}</strong>{choice.detail && <span>{choice.detail}</span>}</> : <span>No favorite chosen yet</span>}</div>{choice && (kind === 'book' || kind === 'series') && <div aria-hidden="true"><BookCover className="rj-profile-cover" src={choice.cover} title={choice.name} /></div>}</dd></div>;
  })}</dl></section>;
}

export function ProfilePreview({ profile: initialProfile, catalog, mode = 'owner', firstLogin = false, currentlyReading, achievement, ...actions }: ProfilePreviewProps) {
  const id = useId();
  // First-login is an explicit story input. Nothing reads auth, activity or storage.
  const [profile, setProfile] = useState(initialProfile);
  const [editor, setEditor] = useState<'setup' | 'edit' | null>(mode === 'owner' && firstLogin ? 'setup' : null);
  const [draft, setDraft] = useState(initialProfile);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [publicOpen, setPublicOpen] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const publicTitle = useRef<HTMLHeadingElement>(null);
  const editTrigger = useRef<HTMLButtonElement>(null);
  const editorReturnFocus = useRef<HTMLButtonElement | null>(null);
  const previewTrigger = useRef<HTMLButtonElement>(null);
  const owner = mode === 'owner';

  function closeEditor() { if (!saving.current) setEditor(null); }
  function edit(event: MouseEvent<HTMLButtonElement>) { editorReturnFocus.current = event.currentTarget; setDraft({ ...profile, favorites: { ...profile.favorites } }); setError(''); setEditor('edit'); }
  async function save() {
    if (saving.current) return;
    saving.current = true;
    setPending(true); setError('');
    const next = { ...draft, name: draft.name.trim(), bio: draft.bio.trim(), favorites: { ...draft.favorites } };
    try {
      await actions.onSave(next);
      setProfile(next); setEditor(null); setNotice('Your profile has been updated.');
    } catch {
      setError('Your profile couldn’t be saved. Your choices are still here. Please try again.');
    } finally { saving.current = false; setPending(false); }
  }

  return <div className="rj-redesign rj-profile-preview"><HomeShell {...actions} activeDestination="Profile">
    <div className="rj-profile-page">
      <header className="rj-profile-heading"><h1 ref={heading} tabIndex={-1}>{owner ? 'Your profile' : 'Reader profile'}</h1>{owner && <Button ref={editTrigger} variant="outline" onClick={edit}><Pencil aria-hidden="true" />Edit profile</Button>}</header>
      <Identity profile={profile} />
      {owner && <div className="rj-profile-owner-tools"><Button ref={previewTrigger} variant="ghost" onClick={() => setPublicOpen(true)}><Eye aria-hidden="true" />Preview public profile</Button><Button variant="ghost" onClick={actions.onSettings}><Settings aria-hidden="true" />Settings</Button></div>}
      <Favorites profile={profile} owner={owner} />
      {owner && !Object.values(profile.favorites).some(Boolean) && <div className="rj-profile-invitation"><p>A few favorites make this space your own. Choose them whenever you’re ready.</p><Button variant="outline" onClick={edit}>Choose your favorites</Button></div>}
      {owner && currentlyReading && <section className="rj-profile-reading"><div><p className="rj-profile-kicker">On your bedside table</p><h2>Currently reading</h2></div><button onClick={() => actions.onOpenBook(currentlyReading.id)}><div aria-hidden="true"><BookCover className="rj-profile-cover" title={currentlyReading.name} src={currentlyReading.cover} /></div><span><strong>{currentlyReading.name}</strong>{currentlyReading.detail && <span>{currentlyReading.detail}</span>}<span className="rj-profile-book-link">Open book ↗</span></span></button></section>}
      {owner && achievement && <section className="rj-profile-achievement" aria-label="Reading milestone"><Sparkles aria-hidden="true" /><div><h2>A moment to keep</h2><p>{achievement}</p></div></section>}
      {owner ? <footer className="rj-profile-community"><p>A small window into your reading world.</p><p>Your chosen favorites can help other readers get to know you.</p></footer> : <footer className="rj-profile-community"><Button variant="outline" onClick={actions.onMessage}><MessageCircle aria-hidden="true" />Start a conversation</Button></footer>}
      <p className="rj-profile-notice" role="status">{notice}</p>
    </div>
  </HomeShell>
    <Dialog open={editor !== null} onOpenChange={open => { if (!open) closeEditor(); }}>
      <DialogContent className="rj-redesign rj-profile-dialog" showCloseButton={false}
        onOpenAutoFocus={event => { event.preventDefault(); title.current?.focus(); }}
        onCloseAutoFocus={event => { event.preventDefault(); (editorReturnFocus.current?.isConnected ? editorReturnFocus.current : editTrigger.current || heading.current)?.focus(); }}
        onEscapeKeyDown={event => { if (saving.current) event.preventDefault(); }} onInteractOutside={event => event.preventDefault()}>
        <header><DialogTitle ref={title} tabIndex={-1}>{editor === 'setup' ? 'Make this profile yours' : 'Edit your profile'}</DialogTitle><DialogDescription>{editor === 'setup' ? 'Choose a few reading favorites. Every choice is optional, and you can change them later.' : 'A little about you, and the favorites you choose yourself.'}</DialogDescription></header>
        <form onSubmit={event => { event.preventDefault(); void save(); }} aria-busy={pending}>
          <div className="rj-profile-form-scroll"><fieldset disabled={pending}>
            {editor !== 'setup' && <div className="rj-profile-identity-fields"><label htmlFor={`${id}-name`}>Display name<input id={`${id}-name`} required maxLength={100} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} pattern=".*\S.*" /></label><label htmlFor={`${id}-bio`}>Bio <span>(optional)</span><textarea id={`${id}-bio`} maxLength={400} rows={3} value={draft.bio} onChange={event => setDraft({ ...draft, bio: event.target.value })} /></label></div>}
            <p className="rj-profile-form-help" id={`${id}-help`}>Choose from beyond your library, too. Leave a choice blank if nothing comes to mind.</p>
            <div className="rj-profile-picker-grid">{favoriteKinds.map(kind => {
              const selected = draft.favorites[kind];
              const options = selected && !catalog[kind].some(choice => choice.id === selected.id) ? [selected, ...catalog[kind]] : catalog[kind];
              return <label key={kind} htmlFor={`${id}-${kind}`}><span id={`${id}-${kind}-label`}>{favoriteLabels[kind]}</span><select id={`${id}-${kind}`} aria-labelledby={`${id}-${kind}-label`} aria-describedby={`${id}-help ${id}-${kind}-detail`} value={selected?.id || ''} onChange={event => {
                const favorites = { ...draft.favorites };
                const choice = options.find(option => option.id === event.target.value);
                if (choice) favorites[kind] = choice; else delete favorites[kind];
                setDraft({ ...draft, favorites });
              }}><option value="">No favorite chosen</option>{options.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select><span id={`${id}-${kind}-detail`} className="rj-profile-choice-detail">{selected?.detail || (kind === 'series' ? 'No series in mind? You can leave this blank.' : 'Yours to choose. Yours to change.')}</span></label>;
            })}</div>
          </fieldset>{error && <p role="alert" className="rj-profile-error">{error}</p>}</div>
          <footer><Button type="button" variant="outline" disabled={pending} onClick={closeEditor}>{editor === 'setup' ? 'Skip for now' : 'Cancel'}</Button><Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save profile'}</Button><span role="status" className="sr-only">{pending ? 'Saving your profile. Please wait.' : ''}</span></footer>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={publicOpen} onOpenChange={setPublicOpen}>
      <DialogContent className="rj-redesign rj-profile-dialog rj-profile-public-dialog" showCloseButton={false} onOpenAutoFocus={event => { event.preventDefault(); publicTitle.current?.focus(); }} onCloseAutoFocus={event => { event.preventDefault(); previewTrigger.current?.focus(); }}>
        <header><DialogTitle ref={publicTitle} tabIndex={-1}>Public profile preview</DialogTitle><DialogDescription>A look at your reader introduction and chosen favorites.</DialogDescription></header><div className="rj-profile-public-scroll" tabIndex={0} role="region" aria-label="Public profile"><Identity profile={profile} /><Favorites profile={profile} /></div><footer><Button variant="outline" onClick={() => setPublicOpen(false)}>Back to your profile</Button></footer>
      </DialogContent>
    </Dialog>
  </div>;
}
