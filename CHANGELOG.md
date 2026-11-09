# Changelog

All changes players can notice are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- A desktop app for Windows, macOS and Linux: [download it](https://github.com/FionaPreroll/vibe-wormholesurfing/releases/tag/desktop-latest) as an installer or a zip for Windows, a disk image for Macs with Apple silicon or Intel, or an AppImage or archive for Linux. It plays as the website does, draws and sounds the same on all three, takes controllers, keeps your treasures in its own folder, and opens links in your browser. It is not signed yet: on Windows choose More info, then Run anyway; on a Mac, allow it once under System Settings → Privacy & Security → Open Anyway.
- The desktop app tells you when a new version is out, if you let it look when it first asks, or later under Settings → App updates. Download opens the new version in your browser; it installs over the app and keeps your treasures and settings. Its about page says which system and build it is, and links the web version and every build.
- On a computer, the website's about page offers the desktop app for your system, with how to open it the first time.
- The first version of Wormhole Surfing: ride a cute spaceship through a swirling wormhole with a chibi girl in the cockpit. Golden orbs speed you up, blue sparks slow you down, and the farther you fly, the rarer the warp holes: plain ones, ones with one or two golden halos, and the rarest with a flower-shaped aura.
- Slow down too much and the holes start to pull; too slow, and the next hole takes you in whatever you do.
- Eight 3D worlds behind the holes: the Cliffs, the Lagoon, the Canyon and the Caverns behind red, blue, green and yellow holes, and four strange worlds behind white ones: the Crystal Sea, the Star Dunes, the Floating Gardens and the Aurora Void.
- In each world the girl walks to a pillar of light and opens a star capsule. What it holds is decided at random by the hole's rarity and the distance flown: forty treasures in five rarities, sometimes shiny. A flower-aura hole always holds its world's legendary treasure until you have it.
- A collection of every treasure found, with pictures, counts and shiny finds, kept in the browser.
- Play with keyboard, mouse, game controller, touch screen or by tilting the device. Menus work with a controller too.
- Settings for sound, music, graphics quality, tilt steering and its range, inverted flying, mouse steering, camera speed, vibration, less motion and a frame counter. English and German.
- Music and sounds generated live, in a mood of their own for every world.
- The game installs as an app and plays offline.
- A cockpit panel shows the ship's speed on a rainbow gauge, with the pull of holes on an inner arc, and the orbs, sparks, time and your farthest ride on glowing seven-segment LCDs; in a world, where you are, how far you flew and how near the treasure is. The light-years at the top are an LCD too.
- A new treasure flies from its card into its place in the collection when you open the collection from there, and lands with a pop; others found since your last look pop in their places, and the Collection button counts them.
- Share your collection: a picture of every world's treasures with your numbers goes to your phone's share sheet, or is saved with a text to post copied, where there is no share sheet.
- Every treasure has a short description. Tap or click a found treasure in the collection to see it up close, with its rarity, world, how often it was found, how many were shiny, and a list of every find with its date, distance, world and hole.
- The girl wears swimming shoes: deep water no longer stops her, she swims across it with her head above the surface, and ripples ring around her in water.
- An about page with what the game is, how it is made, your data, the debug log and every change, in place of the small about box.
- Export your save as a file and import it again, to keep a backup or to carry your treasures to another browser or device. Both are on the about page and in the settings.
- An exportable debug log: your device and graphics chip, how fast frames came each second, and any glitches, errors and long frames, to send along with a bug report.
- The browser keeps the debug logs of your last three sessions, so a glitch can still be reported after a reload or a crash; each can be exported from the about page and the settings.
- Report a problem straight from the debug log: on GitHub, in a bug report form with the details filled in, or by email. The log is saved as a file to attach.
- The about page has a contact address and a link to the issue tracker, and shows how to install the game as an app in the browser, or links to the web version in the installed app.
- An Android app: [download it](https://github.com/FionaPreroll/vibe-wormholesurfing/releases/latest/download/wormhole-surfing.apk) and open it on your phone. It plays full screen in landscape, offline, keeps the screen on while you steer by tilting, and the back button closes dialogs, pauses and goes back. Saving, exporting and sharing go through Android's own file and share dialogs. The about page of the website links to it.
- The Android app can update itself: at the first start it asks whether to look for a new version at every start (off unless you say yes; you can change it in the settings, or look right away). A new version shows its size, warns on mobile data, downloads with pause and resume, and installs after Android asks you.
- The game pauses and goes quiet when you switch to another app or tab.
- While the 3D engine loads, a bar shows how much has arrived, how fast, how long it took and how long it should still take.
- On foot, the arrow keys turn the camera; WASD walks.
- The frame counter in the settings also shows the time per frame, the resolution and the draw calls. It sits in the top left corner, clear of the panels.
- Change every key and controller button: Settings → Controller and keys gives each action two keys and two buttons. Choose a slot and press the key or button for it; it moves from wherever it was. Back to the defaults is one button away.
- Tune the controller's sticks: how strongly each answers, how large its dead zone is, and its shape: round, cross (each axis on its own, for straight lines) or square (the slightest push along an axis counts). A picture shows what the stick does as you lean it. The sticks can also be swapped.
- A Full screen button on the title screen in every browser, not only on touch screens, so a controller can reach it too.
- The debug log sums up every minute of the session, not only the last quarter of an hour: frames per second, the slowest frame, memory, geometries and textures, so a long session shows whether anything piles up.
- The mouse pointer goes while you play with a controller or the keys, and when the mouse rests a moment in a ride or a world; it comes back as soon as the mouse moves.
- A debug setting shows the hitboxes in rides: the circles the ship, orbs, sparks and warp holes are tested with, and the edge of the field the ship stays in.
- The arrow keys move through the menus and dialogs as the D-pad does: up and down from row to row, left and right along a row and through lists. Sliders keep left and right for themselves.
- A setting for the see-through ship in rides: automatic (see-through at High and Ultra), on or off.
- Exported files carry the date and the time to the second in their names, so exports of one day no longer pile up under the same name.
- Make the HUD smaller or larger, from a fifth of its size to four times, and the menus, dialogs and the treasure card from half to twice their size, under Display in the settings. Each panel of the HUD grows from its own corner.
- Invert the camera's up and down, for the stick, the keys, the mouse and fingers alike, apart from inverting the ship's.
- The game names the buttons as your controller prints them: ✕ ○ □ △, L1 and R2 on a PlayStation controller, the swapped letters of a Nintendo one, and the letters of others. Keys are named as your keyboard's layout prints them, where the browser tells. The hints in a ride and in a world, and the help, name the keys and buttons as you bound them.

### Changed

- The ship meets orbs and sparks with the tip of its nose, where you see it touch them, instead of with its middle. The hitbox moves with the nose as the ship turns and climbs. Warp holes still take the ship by its middle, so they are a little easier to steer clear of. To meet orbs and sparks with the ship's middle again, switch off "Ship's hitbox for orbs and sparks at the tip of its nose" under Controls in the settings.
- The about page tells the Android app apart from the web app a browser installed: the app names its version and how it looks for updates, the web app says how it updates and, on Android, offers the Android app too.
- In a ride, the ship and the girl are a little see-through, so what comes toward you shows through them where they sit in the middle of the screen. On the title screen they show whole.
- On low and medium graphics, as phones and tablets use, buttons and panels are a little darker instead of frosted glass. Blurring the moving 3D view behind them cost phones more frames than the 3D view itself.
- New fonts: the logo and headings in the wide, bold Unbounded, and everything else in the rounded Fredoka. The title screen is easier to read over the bright wormhole: the logo has a dark edge, the tagline and the treasure count sit on dark glass, and the top and bottom of the screen are a little darker.
- The Caverns are lighter and glow less, so the cave can be seen; a soft light goes along with the girl in dark worlds.

### Fixed

- The girl's twin tails and scarf stream back in the wind behind her, instead of flying forward in front of her face.
- The Android app no longer closes when you export the debug log. While Android's save dialog was open, the whole log went into the app's saved state, which Android limits to about a megabyte; now the file waits in the app's cache until you have chosen where it goes.
- Rides run more smoothly on phones: the cockpit was drawn again for every frame, whether its numbers had changed or not. It now changes only when a number or the gauge it shows does, and the light-years count at most twenty times a second. Below high quality the cockpit's digits and gauge also do without their glow, and the gauge no longer animates between its values, which had it painted again every frame anyway.
- At medium and low quality, as phones use, the ship is whole in rides by default: being see-through cost a fifth more of a phone's drawing.
- On phones, the title screen runs as smoothly as a ride. Its logo's moving colors had the browser paint the logo, with its glows, again for every frame, and a darkening layer over the whole page cost a blend of the whole screen every frame. Below high quality the logo now holds its colors still, and the darkening is part of the 3D picture.
- On screens that show more frames a second than the ride steps, as 144 Hz monitors do, the ship, the girl and everything flying toward them no longer judder on the title screen and in rides: the ride steps 120 times a second, so every sixth frame nothing moved. What a frame comes before the next step is now drawn ahead.
- Buttons and other controls light up again when a controller moves the focus, also after a click with the mouse; a click hides the highlight until a controller or a key moves the focus again.
- In the Controller and keys dialog, trying out the sticks no longer scrolls the dialog or moves the focus: there the D-pad moves the focus.
- The treasure capsule no longer lies in a hollow or at the foot of a wall, where it was hard to see, as could happen in the Canyon; it stands on open ground that can be seen from several sides. When it opens, the camera no longer runs into a wall or a rock beside it: it turns to a side with a clear view, or rises to see over what stands in the way.
- The ship and the girl no longer glitch on the title screen and while flying: since the ship became see-through in rides, it drew over its own engine flames and the light trails of its wing tips, which flickered as it turned, and on Macs its hull could flicker too. On the title screen it draws whole again, as before; in a ride, flames, trails and bursts of light draw over it.
- On Windows, the first title screen no longer freezes for over two seconds while its shaders compile, and starting a ride or going back to the title screen no longer stutters for a tenth of a second: each stage compiles its shaders alongside the frames before it shows, and keeps those of the stage before instead of building them again. The first orb, spark and rare warp hole of a ride no longer stutter either.
- The guard that blacks out broken pixels before the glow works on Windows too: Direct3D's shader compiler had dropped its test for them.
- Entering a world no longer freezes the picture for up to two seconds while its shaders compile: the world is made ready during the warp, its shaders compile alongside the frames, and the rest of its setup happens while the warp's light holds the screen white. Starting a ride and going back to the title screen no longer stall either: every stage that went away took the girl's outline shader with it, to be compiled again by the next.
- On phones where a lower resolution does not make the game any faster, it no longer drops the resolution anyway, which only made the picture blurry.
- Long sessions no longer fill up the graphics chip's memory: every world left its reflections, its sun's shadow map and its ground behind (about 10 MB a world at medium quality, over 130 MB at ultra), every ride its reflections, and every change of the graphics quality the buffers of the glow effect.
- The share picture of the collection no longer runs the web address into the last world's name, and keeps the same margin to every edge.
- On Macs and other computers with a real graphics chip, the picture no longer turns black except for a strip at the edge: a glint of light on the ship could overflow and spread across the screen.
- After switching the graphics quality, as to Ultra, the picture no longer stays black.
- The picture no longer flashes black for a frame when the game changes its resolution to keep up, as it often did right after arriving in a world.
- In the Lagoon and the Crystal Sea, the girl no longer gets stuck at the edge of deep water.
- The girl no longer walks into the treasure capsule; she stops at its pedestal.
- On phones, help, the settings and the other dialogs fit the screen and scroll with a finger; before, they ran off the bottom of the screen.
- The treasure card after opening a capsule no longer shows scroll bars on large screens: its turning rays reached past its edge. Once it has landed, Fly again has the focus, so a controller's A or Enter flies on, the D-pad picks Collection or Title screen, and B goes back to the title screen.
- The hints at the start of the first ride and the first walk no longer wait for a click: they go by themselves after ten seconds (a bar shows the time left), or at a single press of A or B on a controller, or Enter or Space. The mouse steers across them, too.
- The debug log no longer counts it as a glitch when the browser stops drawing for a while, as macOS does for a covered window: such pauses are noted as information, and leave the frame statistics alone. Long frames now note how long the game's own drawing took and how many shaders were built meanwhile.
- With a controller, every setting can be reached: the D-pad and the left stick go down row by row without skipping tick boxes or rows, left and right go along a row of buttons, and move sliders and switch lists such as the graphics quality and the language. The right stick scrolls long dialogs.
- At the start of a ride the ship no longer darts toward the mouse pointer, which still rests on the button that started the ride: the mouse steers once it is moved during the ride, or clicked on the game.
