"""SSH into the server and check stem counts for these 4 specific tracks."""
import paramiko

host, port, user, pw = '82.197.80.52', 65002, 'u567784230', 'Split12345!'
pub = '/home/u567784230/domains/springgreen-mandrill-515031.hostingersite.com/public_html'

php = f"""<?php
define('LARAVEL_START', microtime(true));
require '{pub}/vendor/autoload.php';
$app = require_once '{pub}/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

$tracks = [
    ['De La Soul', 'Can U Keep a Secret'],
    ['De La Soul', 'Me Myself and I'],
    ['Erick Sermon', 'Bomdigi'],
    ['Freddie Gibbs', 'I Still Love H.E.R.'],
];

echo "=== INCOMPLETE TRACK CHECK ===" . PHP_EOL;
foreach ($tracks as [$artist, $title]) {{
    $stems = App\\Models\\Stem::where('artist', $artist)
        ->where('title', 'LIKE', '%' . $title . '%')
        ->where('is_visible', true)
        ->pluck('stem_type')
        ->sort()
        ->values()
        ->toArray();
    $count = count($stems);
    $types = implode(', ', $stems);
    $status = $count >= 5 ? 'COMPLETE' : ($count == 0 ? 'MISSING' : 'PARTIAL ' . $count . '/5');
    echo $status . '  ' . $artist . ' - ' . $title . '  [' . $types . ']' . PHP_EOL;
}}

echo PHP_EOL . "=== HIP-HOP TOTALS ===" . PHP_EOL;
echo 'Visible stems: ' . App\\Models\\Stem::where('is_visible',true)->where('genre','Hip-Hop')->count() . PHP_EOL;

echo PHP_EOL . "=== TRACKS WITH <5 STEMS ===" . PHP_EOL;
App\\Models\\Stem::where('is_visible',true)->where('genre','Hip-Hop')
    ->select('artist','title', DB::raw('count(*) as cnt'))
    ->groupBy('artist','title')
    ->having('cnt', '<', 5)
    ->orderBy('artist')
    ->get()
    ->each(fn($r) => print($r->cnt . '/5  ' . $r->artist . ' - ' . $r->title . PHP_EOL));
echo '(none)' . PHP_EOL;
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, port=port, username=user, password=pw, timeout=15)
_, o, e = client.exec_command(f"cat > /tmp/chk.php << 'EOF'\n{php}\nEOF\nphp /tmp/chk.php", timeout=45)
print(o.read().decode('utf-8', errors='replace'))
err = e.read().decode('utf-8', errors='replace').strip()
if err: print('STDERR:', err)
client.close()
