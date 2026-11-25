# Project Handoff Summary: Automated Three-Pump Water Feature

## 1. Project Goal

Build a fully automated, non-blocking indoor tabletop water feature using **MicroPython** on an **ESP32-S3 / Arduino Nano ESP32** microcontroller. The system must produce natural, smoothly changing, synchronized water flow, ultrasonic mist, and white **LED (Light-Emitting Diode)** lighting that progressively evolves over time, paired with non-blocking serial telemetry for debugging.

### Core Behavioral & Software Requirements

* **Single Non-Blocking Control Loop:** Runs on a ~`20 ms` tick using `time.ticks_ms()` and `time.ticks_diff()` (safe against tick wraparound; no blocking sleeps during control logic).
* **Independent Pump Control (`PumpController`):** Three pumps operate with distinct `ON`/`OFF` phases, smooth flow levels (`0.0–10.0`), and `smoothstep` (`3t² - 2t³`) interpolation. Mid-cycle flow adjustments respect remaining `ON` time, and `OFF` transitions ramp cleanly to `0.0` flow without mid-phase drift or stale targets.
* **10-Minute Progressive Evolution (`PumpProfileEvolver`):** Over a `600,000 ms` (10-minute) cycle, each pump's flow range (`min_flow`, `max_flow`), `ON`/`OFF` duration bounds, and ramp timing smoothly evolve via `smoothstep` toward new randomized targets blended with current values and constrained by `HARD_BOUNDS`.
* **Synchronized Mist & White LED:**
* `avg_activity` (`0.0–1.0`) is calculated each tick from combined pump flow (`total_flow / (num_pumps * 10)`).
* `AverageCoupledMistController` couples mist level (`0.0–10.0`) and a dynamic ceiling (`cap`) to `avg_activity`, ramping smoothly (`smoothstep`), holding briefly, fading out cleanly when pumps stop, and driving a digital burst window (e.g., `1500 ms` period).
* `AverageSyncedWhiteLedController` smoothly glides LED brightness (`0–255` mapped to `duty_u16`) from a weighted combination of normalized `avg_activity` and normalized mist level (settling to an idle level when inactive).


* **Non-Blocking Debugging (`DebugLogger`):** Prints periodic serial status lines (`uptime_s`, `dt_ms`, evolution cycle/progress, per-pump flow/bounds/phase, `avg_activity`, mist level/cap/burst pin state, and LED brightness) plus evolution cycle boundary targets.

---

## 2. Hardware & Circuit Details

### Power & Grounding Architecture

* **Power Supply:** Regulated **5V (3A+ recommended)** supply providing `+5V` and **common `GND` (Ground)**.
* **Common Ground Rule:** Tie the **5V power supply `GND**`, **microcontroller `GND**`, **MOSFET (Metal-Oxide-Semiconductor Field-Effect Transistor) / switch module `GND**`, **mist maker `GND**`, and **LED ground return** together so PWM (Pulse Width Modulation) and control signals share a single reference.
* **No Manual Potentiometers Required:** Flow levels and 10-minute evolution are automated in firmware; `10 kΩ` rotary potentiometers are not needed for pump control.
* **PWM Channel Allocation:** Requires **4 PWM channels** (3 pumps + 1 white LED) plus **1 digital GPIO** for the mist burst switch. On the **Arduino Nano ESP32** (ESP32-S3, `3.3V` logic), hardware LEDC PWM supports multiple channels across timers, and any general GPIO pin can output PWM.

### Actuators, Switching & Protection Components

1. **3× Brushless 3V–5V DC Water Pumps:**
* Driven via **low-side PWM** through **MOSFET switch modules** (e.g., **AOD4184** channels).
* Calibrated with a minimum active PWM floor (e.g., `150/255` $\approx 3.0\text{ V}$) so brushless motor drivers start reliably, scaling up to `255/255` ($\approx 5.0\text{ V}$).
* **Protection:** Place a **1N5819 Schottky flyback diode** across each pump (cathode/stripe to `+5V`, anode to switched pump negative/drain side) and add **220 µF–470 µF decoupling/smoothing capacitance** across `+5V` and `GND` near the pumps.


2. **1× 5V 108 kHz Ultrasonic Mist Maker:**
* Switched via a **MOSFET or switch module** controlled by a digital GPIO pin using a slow burst duty cycle (e.g., `1500 ms` burst period)—do **not** use high-frequency motor PWM on the mist module.


3. **1× Bright White LED:**
* **Low-current LED (`~10–20 mA`) driven from GPIO:** Connect GPIO (PWM) $\rightarrow$ **current-limiting resistor** (`47 Ω–100 Ω` on `3.3V` logic; `150 Ω–220 Ω` on `5V` logic) $\rightarrow$ LED anode (`+`); LED cathode (`-`) $\rightarrow$ common `GND`.
* **High-power LED / LED strip (`> 30–40 mA`):** Drive from `+5V` through a **MOSFET channel** rather than directly from a GPIO pin, using appropriate current limiting for the LED/strip.
* **Bare MOSFET Note:** Pre-built breakout modules typically include gate/pull-down resistors; if wiring bare MOSFETs, add a `100 Ω–220 Ω` gate series resistor and a `10 kΩ` gate-to-`GND` pull-down resistor.



### Reference Pin & Signal Topology

* **Pumps 1–3:** PWM pins (e.g., `GP15`, `GP14`, `GP11`) $\rightarrow$ MOSFET PWM/Gate inputs; `+5V` $\rightarrow$ Pump `+`; Pump `-` $\rightarrow$ MOSFET switched load side; MOSFET `GND` $\rightarrow$ Common `GND`.
* **Mist Maker:** Digital GPIO (e.g., `GP13`) $\rightarrow$ Mist switch/MOSFET control; `+5V` & Common `GND` wired through switch/module to mist maker.
* **White LED:** PWM pin (e.g., `GP12`) $\rightarrow$ Resistor (or MOSFET gate) $\rightarrow$ LED; LED return/MOSFET source $\rightarrow$ Common `GND`.

---

## 3. Handoff Notes for Next LLM

* Preserve the single-loop non-blocking architecture (`time.ticks_diff()`), `smoothstep01()` easing, `HARD_BOUNDS` safety clamping, and `DebugLogger` visibility when adding features (such as quiet/night mode, button/ADC inputs, schematic exports in CircuiTikZ/Schemdraw/Mermaid, or ESP32-S3 pin assignments).