import os

base = r"C:\Users\songo\Desktop\Sample Split 2027\Samples Split 2027"

stems = [
    # De La Soul - Can U Keep a Secret
    r"Web Library\Hip Hop\Acapella\De La Soul - Can U Keep a Secret Acapella [BPM 99 A# minor]\De La Soul - Can U Keep a Secret Acapella [BPM 99 A# minor].mp3",
    r"Web Library\Hip Hop\Drums\De La Soul - Can U Keep a Secret Drums [BPM 99]\De La Soul - Can U Keep a Secret Drums [BPM 99].mp3",
    r"Web Library\Hip Hop\Bass\De La Soul - Can U Keep a Secret Bass [BPM 99 A# minor]\De La Soul - Can U Keep a Secret Bass [BPM 99 A# minor].mp3",
    r"Web Library\Hip Hop\Melody\De La Soul - Can U Keep a Secret Melody [BPM 99 A# minor]\De La Soul - Can U Keep a Secret Melody [BPM 99 A# minor].mp3",
    r"Web Library\Hip Hop\Instrumental\De La Soul - Can U Keep a Secret Instrumental\De La Soul - Can U Keep a Secret Instrumental.mp3",
    # De La Soul - Me Myself and I
    r"Web Library\Hip Hop\Acapella\De La Soul - Me Myself and I Acapella [BPM 115 D minor]\De La Soul - Me Myself and I Acapella [BPM 115 D minor].mp3",
    r"Web Library\Hip Hop\Drums\De La Soul - Me Myself and I Drums [BPM 115]\De La Soul - Me Myself and I Drums [BPM 115].mp3",
    r"Web Library\Hip Hop\Bass\De La Soul - Me Myself and I Bass [BPM 115 D minor]\De La Soul - Me Myself and I Bass [BPM 115 D minor].mp3",
    r"Web Library\Hip Hop\Melody\De La Soul - Me Myself and I Melody [BPM 115 D minor]\De La Soul - Me Myself and I Melody [BPM 115 D minor].mp3",
    r"Web Library\Hip Hop\Instrumental\De La Soul - Me Myself and I Instrumental [BPM 115 D minor]\De La Soul - Me Myself and I Instrumental [BPM 115 D minor].mp3",
    # Erick Sermon - Bomdigi
    r"Web Library\Hip Hop\Acapella\Erick Sermon - Bomdigi Acapella [BPM 90 C# major]\Erick Sermon - Bomdigi Acapella [BPM 90 C# major].mp3",
    r"Web Library\Hip Hop\Drums\Erick Sermon - Bomdigi Drums [BPM 90]\Erick Sermon - Bomdigi Drums [BPM 90].mp3",
    r"Web Library\Hip Hop\Bass\Erick Sermon - Bomdigi Bass [BPM 90 C# major]\Erick Sermon - Bomdigi Bass [BPM 90 C# major].mp3",
    r"Web Library\Hip Hop\Melody\Erick Sermon - Bomdigi Melody [BPM 90 C# major]\Erick Sermon - Bomdigi Melody [BPM 90 C# major].mp3",
    r"Web Library\Hip Hop\Instrumental\Erick Sermon - Bomdigi Instrumental [BPM 90 C# major]\Erick Sermon - Bomdigi Instrumental [BPM 90 C# major].mp3",
    # Freddie Gibbs - I Still Love H.E.R.
    r"Web Library\Hip Hop\Acapella\Freddie Gibbs - I Still Love H.E.R. Acapella\Freddie Gibbs - I Still Love H.E.R. Acapella.mp3",
    r"Web Library\Hip Hop\Drums\Freddie Gibbs - I Still Love H.E.R. Drums [BPM 110]\Freddie Gibbs - I Still Love H.E.R. Drums [BPM 110].mp3",
    r"Web Library\Hip Hop\Bass\Freddie Gibbs - I Still Love H.E.R. Bass [BPM 110 C# major]\Freddie Gibbs - I Still Love H.E.R. Bass [BPM 110 C# major].mp3",
    r"Web Library\Hip Hop\Melody\Freddie Gibbs - I Still Love H.E.R. Melody\Freddie Gibbs - I Still Love H.E.R. Melody.mp3",
    r"Web Library\Hip Hop\Instrumental\Freddie Gibbs - I Still Love H.E.R. Instrumental\Freddie Gibbs - I Still Love H.E.R. Instrumental.mp3",
]

missing = 0
for rel in stems:
    full = os.path.join(base, rel)
    exists = os.path.exists(full)
    size = os.path.getsize(full) if exists else 0
    status = "OK " + str(round(size/1024/1024, 1)) + " MB" if exists else "MISSING"
    print(status + "  " + rel.split("\\")[-1])
    if not exists:
        missing += 1

print()
print("Missing: " + str(missing) + " / " + str(len(stems)))
