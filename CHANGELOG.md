# Changelog

All changes players can notice are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

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
- Report a problem straight from the debug log: on GitHub, with the details filled in, or by email. The log is saved as a file to attach.
- The about page has a contact address and a link to the issue tracker, and shows how to install the game as an app in the browser, or links to the web version in the installed app.
- An Android app: [download it](https://github.com/FionaPreroll/vibe-wormholesurfing/releases/latest/download/wormhole-surfing.apk) and open it on your phone. It plays full screen in landscape, offline, keeps the screen on while you steer by tilting, and the back button closes dialogs, pauses and goes back. Saving, exporting and sharing go through Android's own file and share dialogs. The about page of the website links to it.
- The Android app can update itself: at the first start it asks whether to look for a new version at every start (off unless you say yes; you can change it in the settings, or look right away). A new version shows its size, warns on mobile data, downloads with pause and resume, and installs after Android asks you.
- The game pauses and goes quiet when you switch to another app or tab.
- While the 3D engine loads, a bar shows how much has arrived, how fast, how long it took and how long it should still take.
- On foot, the arrow keys turn the camera; WASD walks.
- The frame counter in the settings also shows the time per frame, the resolution and the draw calls. It sits in the top left corner, clear of the panels.
- Change every key and controller button: Settings → Controller and keys gives each action two keys and two buttons. Choose a slot and press the key or button for it; it moves from wherever it was. Back to the defaults is one button away.
- Tune the controller's sticks: how strongly each answers, how large its dead zone is, and its shape: round, cross (each axis on its own, for straight lines) or square (the slightest push along an axis counts). A picture shows what the stick does as you lean it. The sticks can also be swapped.
- Make the HUD smaller or larger, from a fifth of its size to four times, and the menus, dialogs and the treasure card from half to twice their size, under Display in the settings. Each panel of the HUD grows from its own corner.
- Invert the camera's up and down, for the stick, the keys, the mouse and fingers alike, apart from inverting the ship's.
- The game names the buttons as your controller prints them: ✕ ○ □ △, L1 and R2 on a PlayStation controller, the swapped letters of a Nintendo one, and the letters of others. Keys are named as your keyboard's layout prints them, where the browser tells. The hints in a ride and in a world, and the help, name the keys and buttons as you bound them.

### Changed

- The about page tells the Android app apart from the web app a browser installed: the app names its version and how it looks for updates, the web app says how it updates and, on Android, offers the Android app too.
- In a ride, the ship and the girl are a little see-through, so what comes toward you shows through them where they sit in the middle of the screen. On the title screen they show whole.
- On low and medium graphics, as phones and tablets use, buttons and panels are a little darker instead of frosted glass. Blurring the moving 3D view behind them cost phones more frames than the 3D view itself.
- New fonts: the logo and headings in the wide, bold Unbounded, and everything else in the rounded Fredoka. The title screen is easier to read over the bright wormhole: the logo has a dark edge, the tagline and the treasure count sit on dark glass, and the top and bottom of the screen are a little darker.
- The Caverns are lighter and glow less, so the cave can be seen; a soft light goes along with the girl in dark worlds.

### Fixed

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
- With a controller, every setting can be reached: the D-pad and the left stick go down row by row without skipping tick boxes or rows, left and right go along a row of buttons, and move sliders and switch lists such as the graphics quality and the language. The right stick scrolls long dialogs.
- At the start of a ride the ship no longer darts toward the mouse pointer, which still rests on the button that started the ride: the mouse steers once it is moved during the ride, or clicked on the game.
