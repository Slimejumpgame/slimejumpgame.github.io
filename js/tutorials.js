"use strict";

  let tutorialDragHandDismissed = false;
  let tutorialDragHandAnimationStartTime = 0;

  function resetTutorialDragHand() {
    tutorialDragHandDismissed = false;
    tutorialDragHandAnimationStartTime = worldTime;
  }

  function dismissTutorialDragHand() {
    if (!isTutorialStage() || currentLevel()?.showDragHand !== true) return;
    tutorialDragHandDismissed = true;
  }

  function shouldShowTutorialDragHand() {
    return state === "playing" &&
      isTutorialStage() &&
      currentLevel()?.showDragHand === true &&
      !tutorialDragHandDismissed;
  }

  function getTutorialDragHandElapsed() {
    return Math.max(0, worldTime - tutorialDragHandAnimationStartTime);
  }

  function createTutorialLevel(stageIndex) {
    if (stageIndex === 1) {
      return {
        seed: 1,
        name: "Tutorial 2",
        spawn: {x: 110, y: 590},
        goal: {x: 1100, y: 505, w: 62, h: 92},
        tutorialHeadline: "COLLECT STARS",
        tutorialHeadlineX: 448,
        tutorialHeadlineY: 345,
        platforms: [
          {x: 0, y: 620, w: 360, h: 100},
          {x: 470, y: 540, w: 280, h: 55},
          {x: 850, y: 600, w: 430, h: 120}
        ],
        spikes: [
          {x: 360, y: 690, w: 490, h: 30}
        ],
        pads: [],
        stars: [
          {x: 285, y: 460},
          {x: 465, y: 420},
          {x: 610, y: 455}
        ],
        movers: [],
        fallingPlatforms: [],
        conveyors: [],
        fadePlatforms: [],
        icePlatforms: [],
        spikePlatforms: [],
        enemies: []
      };
    }

    if (stageIndex !== 0) {
      throw new RangeError(`Unbekannte Tutorial-Stage: ${stageIndex}`);
    }

    return {
      seed: 0,
      name: "Tutorial 1",
      spawn: {x: 110, y: 590},
      goal: {x: 1100, y: 505, w: 62, h: 92},
      goalLabel: "FINISH",
      showDragHand: true,
      platforms: [
        {x: 0, y: 620, w: 430, h: 100},
        {x: 750, y: 600, w: 530, h: 120}
      ],
      spikes: [
        {x: 430, y: 690, w: 320, h: 30}
      ],
      pads: [],
      stars: [],
      movers: [],
      fallingPlatforms: [],
      conveyors: [],
      fadePlatforms: [],
      icePlatforms: [],
      spikePlatforms: [],
      enemies: []
    };
  }

  function drawTutorialSketch() {
    if (state !== "playing" || shots > 0 || isTutorialStage() || levelIndex === 0) return;

    const levelNumber = levelIndex + 1;

    // Level 1: vollständige Steuerungsskizze.
    if (levelNumber === 1) {
      const x = 24;
      const y = 58;
      const w = 342;
      const h = 145;

      ctx.save();
      ctx.fillStyle = "rgba(5,15,27,0.88)";
      ctx.strokeStyle = "rgba(121,255,141,0.72)";
      ctx.lineWidth = 3;
      roundedRect(x, y, w, h, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#effff1";
      ctx.font = "800 18px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("So steuerst du:", x + 16, y + 27);

      const slimeX = x + 94;
      const slimeY = y + 91;
      ctx.fillStyle = "#65ee80";
      ctx.strokeStyle = "#194f2d";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(slimeX, slimeY, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#11301d";
      ctx.beginPath();
      ctx.arc(slimeX - 8, slimeY - 3, 3.5, 0, Math.PI * 2);
      ctx.arc(slimeX + 8, slimeY - 3, 3.5, 0, Math.PI * 2);
      ctx.fill();

      const fingerX = x + 178;
      const fingerY = y + 119;
      ctx.fillStyle = "#ffd0ad";
      ctx.strokeStyle = "#8a5139";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fingerX, fingerY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.setLineDash([7, 6]);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(slimeX + 24, slimeY + 8);
      ctx.lineTo(fingerX - 14, fingerY - 3);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = "#79ff8d";
      ctx.fillStyle = "#79ff8d";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(slimeX + 15, slimeY - 16);
      ctx.lineTo(slimeX + 72, slimeY - 62);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(slimeX + 72, slimeY - 62);
      ctx.lineTo(slimeX + 53, slimeY - 58);
      ctx.lineTo(slimeX + 66, slimeY - 43);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#d8eaf6";
      ctx.font = "700 15px system-ui";
      ctx.fillText("Finger zurückziehen", x + 213, y + 76);
      ctx.fillText("und loslassen", x + 213, y + 98);
      ctx.fillStyle = "#9cffaa";
      ctx.fillText("Slime fliegt andersherum", x + 213, y + 124);
      ctx.restore();
      return;
    }

    const tutorials = {
      2: {
        type: "pad",
        title: "Neu: Bounce-Pad",
        line1: "Das blaue Feld schleudert",
        line2: "dich kräftig nach oben."
      },
      4: {
        type: "falling",
        title: "Neu: Fallplattform",
        line1: "Sie wackelt nach der Landung",
        line2: "und fällt dann endgültig weg."
      },
      6: {
        type: "ghost",
        title: "Neu: Böser Geist",
        line1: "Berühre ihn nicht:",
        line2: "Kontakt kostet ein Leben."
      },
      8: {
        type: "moving",
        title: "Neu: Bewegliche Plattform",
        line1: "Sie fährt links, rechts,",
        line2: "nach oben oder nach unten."
      },
      10: {
        type: "conveyor",
        title: "Neu: Förderband",
        line1: "Die Pfeile zeigen, wohin",
        line2: "das Band den Slime schiebt."
      },
      12: {
        type: "fastGhost",
        title: "Neu: Schneller Geist",
        line1: "Orange-rot und deutlich",
        line2: "schneller als der pinke Geist."
      },
      14: {
        type: "fade",
        title: "Neu: Fade-Plattform",
        line1: "Sie verschwindet langsam.",
        line2: "Unter 30 % trägt sie dich nicht."
      },
      16: {
        type: "ice",
        title: "Neu: Eisplattform",
        line1: "Hier ist kaum Reibung:",
        line2: "Du rutschst deutlich weiter."
      },
      18: {
        type: "spikePlatform",
        title: "Neu: Stachelplattform",
        line1: "Orange Warnlicht = gleich gefährlich.",
        line2: "Ausgefahrene Stacheln kosten Leben."
      }
    };

    const tutorial = tutorials[levelNumber];
    if (!tutorial) return;

    const x = 24;
    const y = 58;
    const w = 390;
    const h = 126;
    const iconX = x + 67;
    const iconY = y + 79;

    ctx.save();
    ctx.fillStyle = "rgba(5,15,27,0.9)";
    ctx.strokeStyle = "rgba(121,255,141,0.72)";
    ctx.lineWidth = 3;
    roundedRect(x, y, w, h, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#effff1";
    ctx.font = "800 19px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(tutorial.title, x + 16, y + 28);

    ctx.fillStyle = "#d8eaf6";
    ctx.font = "700 15px system-ui";
    ctx.fillText(tutorial.line1, x + 132, y + 70);
    ctx.fillText(tutorial.line2, x + 132, y + 94);

    if (tutorial.type === "pad") {
      ctx.shadowColor = "#4ddcff";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#47cde9";
      roundedRect(iconX - 42, iconY + 10, 84, 24, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#d1fbff";
      for (let px = iconX - 31; px <= iconX + 19; px += 25) {
        ctx.beginPath();
        ctx.moveTo(px, iconY + 27);
        ctx.lineTo(px + 9, iconY + 14);
        ctx.lineTo(px + 18, iconY + 27);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = "#79ff8d";
      ctx.fillStyle = "#79ff8d";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(iconX, iconY + 2);
      ctx.lineTo(iconX, iconY - 28);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(iconX, iconY - 31);
      ctx.lineTo(iconX - 9, iconY - 17);
      ctx.lineTo(iconX + 9, iconY - 17);
      ctx.closePath();
      ctx.fill();
    } else if (tutorial.type === "falling") {
      ctx.fillStyle = "#815142";
      roundedRect(iconX - 46, iconY - 5, 92, 25, 8);
      ctx.fill();
      ctx.fillStyle = "#ff9d61";
      roundedRect(iconX - 46, iconY - 5, 92, 10, 7);
      ctx.fill();
      ctx.strokeStyle = "#411a14";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(iconX - 15, iconY - 2);
      ctx.lineTo(iconX - 4, iconY + 9);
      ctx.lineTo(iconX - 10, iconY + 18);
      ctx.moveTo(iconX + 18, iconY - 2);
      ctx.lineTo(iconX + 8, iconY + 9);
      ctx.lineTo(iconX + 15, iconY + 18);
      ctx.stroke();
      ctx.strokeStyle = "#ffad70";
      ctx.fillStyle = "#ffad70";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(iconX, iconY + 29);
      ctx.lineTo(iconX, iconY + 48);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(iconX, iconY + 52);
      ctx.lineTo(iconX - 9, iconY + 38);
      ctx.lineTo(iconX + 9, iconY + 38);
      ctx.closePath();
      ctx.fill();
    } else if (tutorial.type === "ghost") {
      const r = 29;
      ctx.shadowColor = "#b46cff";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#d9bcff";
      ctx.strokeStyle = "#6d359e";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(iconX - r, iconY + r * 0.7);
      ctx.lineTo(iconX - r, iconY);
      ctx.quadraticCurveTo(iconX - r, iconY - r, iconX, iconY - r);
      ctx.quadraticCurveTo(iconX + r, iconY - r, iconX + r, iconY);
      ctx.lineTo(iconX + r, iconY + r * 0.7);
      ctx.lineTo(iconX + r * 0.45, iconY + r * 0.4);
      ctx.lineTo(iconX, iconY + r * 0.72);
      ctx.lineTo(iconX - r * 0.45, iconY + r * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#281238";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(iconX - 15, iconY - 8);
      ctx.lineTo(iconX - 4, iconY - 2);
      ctx.moveTo(iconX + 15, iconY - 8);
      ctx.lineTo(iconX + 4, iconY - 2);
      ctx.stroke();
      ctx.fillStyle = "#ff5f79";
      ctx.beginPath();
      ctx.arc(iconX - 8, iconY + 1, 3.5, 0, Math.PI * 2);
      ctx.arc(iconX + 8, iconY + 1, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (tutorial.type === "moving") {
      ctx.fillStyle = "#5e7592";
      roundedRect(iconX - 47, iconY - 4, 94, 26, 9);
      ctx.fill();
      ctx.fillStyle = "#a7d2ff";
      roundedRect(iconX - 47, iconY - 4, 94, 11, 8);
      ctx.fill();

      // Vier Richtungspfeile zeigen, dass Plattformen sich sowohl
      // horizontal als auch vertikal bewegen können.
      ctx.strokeStyle = "#a7d2ff";
      ctx.fillStyle = "#a7d2ff";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(iconX - 44, iconY + 39);
      ctx.lineTo(iconX + 44, iconY + 39);
      ctx.moveTo(iconX, iconY - 34);
      ctx.lineTo(iconX, iconY + 57);
      ctx.stroke();

      // Links.
      ctx.beginPath();
      ctx.moveTo(iconX - 48, iconY + 39);
      ctx.lineTo(iconX - 32, iconY + 29);
      ctx.lineTo(iconX - 32, iconY + 49);
      ctx.closePath();
      ctx.fill();

      // Rechts.
      ctx.beginPath();
      ctx.moveTo(iconX + 48, iconY + 39);
      ctx.lineTo(iconX + 32, iconY + 29);
      ctx.lineTo(iconX + 32, iconY + 49);
      ctx.closePath();
      ctx.fill();

      // Oben.
      ctx.beginPath();
      ctx.moveTo(iconX, iconY - 39);
      ctx.lineTo(iconX - 10, iconY - 23);
      ctx.lineTo(iconX + 10, iconY - 23);
      ctx.closePath();
      ctx.fill();

      // Unten.
      ctx.beginPath();
      ctx.moveTo(iconX, iconY + 62);
      ctx.lineTo(iconX - 10, iconY + 46);
      ctx.lineTo(iconX + 10, iconY + 46);
      ctx.closePath();
      ctx.fill();
    } else if (tutorial.type === "conveyor") {
      ctx.fillStyle = "#4a4f5b";
      roundedRect(iconX - 49, iconY - 3, 98, 28, 9);
      ctx.fill();
      ctx.fillStyle = "#ffad45";
      roundedRect(iconX - 49, iconY - 3, 98, 11, 8);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      for (let px = iconX - 31; px <= iconX + 31; px += 31) {
        ctx.beginPath();
        ctx.moveTo(px - 8, iconY - 1);
        ctx.lineTo(px, iconY + 3);
        ctx.lineTo(px - 8, iconY + 7);
        ctx.stroke();
      }
      ctx.fillStyle = "#222630";
      for (let px = iconX - 32; px <= iconX + 32; px += 32) {
        ctx.beginPath();
        ctx.arc(px, iconY + 16, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (tutorial.type === "fade") {
      ctx.save();
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = "#584f87";
      roundedRect(iconX - 48, iconY - 4, 96, 26, 9);
      ctx.fill();
      ctx.fillStyle = "#d5b9ff";
      roundedRect(iconX - 48, iconY - 4, 96, 11, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(238,226,255,0.95)";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 7]);
      roundedRect(iconX - 43, iconY + 1, 86, 16, 6);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.fillStyle = "#d5b9ff";
      ctx.font = "900 15px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("100% → 30% → 0%", iconX, iconY + 48);
    } else if (tutorial.type === "ice") {
      ctx.fillStyle = "#75bad1";
      roundedRect(iconX - 49, iconY - 4, 98, 27, 9);
      ctx.fill();
      ctx.fillStyle = "#e8fbff";
      roundedRect(iconX - 49, iconY - 4, 98, 11, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 3;
      for (let px = iconX - 31; px <= iconX + 31; px += 31) {
        ctx.beginPath();
        ctx.moveTo(px - 9, iconY + 18);
        ctx.lineTo(px + 8, iconY - 1);
        ctx.stroke();
      }
      ctx.strokeStyle = "#9feeff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(iconX - 45, iconY + 44);
      ctx.lineTo(iconX + 36, iconY + 44);
      ctx.stroke();
      ctx.fillStyle = "#9feeff";
      ctx.beginPath();
      ctx.moveTo(iconX + 48, iconY + 44);
      ctx.lineTo(iconX + 31, iconY + 34);
      ctx.lineTo(iconX + 31, iconY + 54);
      ctx.closePath();
      ctx.fill();
    } else if (tutorial.type === "spikePlatform") {
      ctx.fillStyle = "#5b4e58";
      roundedRect(iconX - 49, iconY - 3, 98, 28, 9);
      ctx.fill();
      ctx.fillStyle = "#ff705d";
      roundedRect(iconX - 49, iconY - 3, 98, 11, 8);
      ctx.fill();

      ctx.fillStyle = "rgba(43,27,32,0.85)";
      for (let px = iconX - 34; px <= iconX + 34; px += 17) {
        roundedRect(px - 5, iconY + 1, 10, 4, 2);
        ctx.fill();
      }

      ctx.fillStyle = "#dce8ed";
      ctx.strokeStyle = "#ff6d57";
      ctx.lineWidth = 2;
      const count = 5;
      const step = 82 / count;
      for (let i = 0; i < count; i++) {
        const left = iconX - 41 + i * step;
        const right = iconX - 41 + (i + 1) * step;
        ctx.beginPath();
        ctx.moveTo(left + 2, iconY + 4);
        ctx.lineTo((left + right) / 2, iconY - 22);
        ctx.lineTo(right - 2, iconY + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = "#ffc15c";
      ctx.font = "900 14px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("WARNUNG → STACHELN", iconX, iconY + 48);
    } else if (tutorial.type === "fastGhost") {
      const r = 29;
      ctx.shadowColor = "#ff552f";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#ff9a5c";
      ctx.strokeStyle = "#9c321f";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(iconX - r, iconY + r * 0.7);
      ctx.lineTo(iconX - r, iconY);
      ctx.quadraticCurveTo(iconX - r, iconY - r, iconX, iconY - r);
      ctx.quadraticCurveTo(iconX + r, iconY - r, iconX + r, iconY);
      ctx.lineTo(iconX + r, iconY + r * 0.7);
      ctx.lineTo(iconX + r * 0.45, iconY + r * 0.4);
      ctx.lineTo(iconX, iconY + r * 0.72);
      ctx.lineTo(iconX - r * 0.45, iconY + r * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#3a1711";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(iconX - 15, iconY - 8);
      ctx.lineTo(iconX - 4, iconY - 2);
      ctx.moveTo(iconX + 15, iconY - 8);
      ctx.lineTo(iconX + 4, iconY - 2);
      ctx.stroke();
      ctx.fillStyle = "#ffe06a";
      ctx.beginPath();
      ctx.arc(iconX - 8, iconY + 1, 3.5, 0, Math.PI * 2);
      ctx.arc(iconX + 8, iconY + 1, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffad45";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(iconX - 58, iconY - 15);
      ctx.lineTo(iconX - 40, iconY - 15);
      ctx.moveTo(iconX - 64, iconY);
      ctx.lineTo(iconX - 42, iconY);
      ctx.moveTo(iconX - 57, iconY + 15);
      ctx.lineTo(iconX - 39, iconY + 15);
      ctx.stroke();
    }

    ctx.restore();
  }


  function roundedRectOn(targetCtx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    targetCtx.beginPath();
    targetCtx.moveTo(x + rr, y);
    targetCtx.arcTo(x + w, y, x + w, y + h, rr);
    targetCtx.arcTo(x + w, y + h, x, y + h, rr);
    targetCtx.arcTo(x, y + h, x, y, rr);
    targetCtx.arcTo(x, y, x + w, y, rr);
    targetCtx.closePath();
  }

  function drawHowToCanvasIcon(canvas, type) {
    const ictx = canvas.getContext('2d');
    if (!ictx) return;
    const baseW = 120;
    const baseH = 80;
    const scaleX = canvas.width / baseW;
    const scaleY = canvas.height / baseH;
    const iconX = 60;
    const iconY = 32;

    ictx.clearRect(0, 0, canvas.width, canvas.height);
    ictx.save();
    ictx.scale(scaleX, scaleY);
    ictx.lineJoin = 'round';
    ictx.lineCap = 'round';

    if (type === 'pad') {
      ictx.shadowColor = '#4ddcff';
      ictx.shadowBlur = 12;
      ictx.fillStyle = '#47cde9';
      roundedRectOn(ictx, iconX - 42, iconY + 10, 84, 24, 8);
      ictx.fill();
      ictx.shadowBlur = 0;
      ictx.fillStyle = '#d1fbff';
      for (let px = iconX - 31; px <= iconX + 19; px += 25) {
        ictx.beginPath();
        ictx.moveTo(px, iconY + 27);
        ictx.lineTo(px + 9, iconY + 14);
        ictx.lineTo(px + 18, iconY + 27);
        ictx.closePath();
        ictx.fill();
      }
      ictx.strokeStyle = '#79ff8d';
      ictx.fillStyle = '#79ff8d';
      ictx.lineWidth = 5;
      ictx.beginPath();
      ictx.moveTo(iconX, iconY + 2);
      ictx.lineTo(iconX, iconY - 28);
      ictx.stroke();
      ictx.beginPath();
      ictx.moveTo(iconX, iconY - 31);
      ictx.lineTo(iconX - 9, iconY - 17);
      ictx.lineTo(iconX + 9, iconY - 17);
      ictx.closePath();
      ictx.fill();
    } else if (type === 'falling') {
      ictx.fillStyle = '#815142';
      roundedRectOn(ictx, iconX - 46, iconY - 5, 92, 25, 8);
      ictx.fill();
      ictx.fillStyle = '#ff9d61';
      roundedRectOn(ictx, iconX - 46, iconY - 5, 92, 10, 7);
      ictx.fill();
      ictx.strokeStyle = '#411a14';
      ictx.lineWidth = 3;
      ictx.beginPath();
      ictx.moveTo(iconX - 15, iconY - 2);
      ictx.lineTo(iconX - 4, iconY + 9);
      ictx.lineTo(iconX - 10, iconY + 18);
      ictx.moveTo(iconX + 18, iconY - 2);
      ictx.lineTo(iconX + 8, iconY + 9);
      ictx.lineTo(iconX + 15, iconY + 18);
      ictx.stroke();
      ictx.strokeStyle = '#ffad70';
      ictx.fillStyle = '#ffad70';
      ictx.lineWidth = 5;
      ictx.beginPath();
      ictx.moveTo(iconX, iconY + 29);
      ictx.lineTo(iconX, iconY + 44);
      ictx.stroke();
      ictx.beginPath();
      ictx.moveTo(iconX, iconY + 48);
      ictx.lineTo(iconX - 9, iconY + 34);
      ictx.lineTo(iconX + 9, iconY + 34);
      ictx.closePath();
      ictx.fill();
    } else if (type === 'ghost' || type === 'fastGhost') {
      const r = 24;
      const fast = type === 'fastGhost';
      ictx.shadowColor = fast ? '#ff552f' : '#b46cff';
      ictx.shadowBlur = 12;
      ictx.fillStyle = fast ? '#ff9a5c' : '#d9bcff';
      ictx.strokeStyle = fast ? '#9c321f' : '#6d359e';
      ictx.lineWidth = 4;
      ictx.beginPath();
      ictx.moveTo(iconX - r, iconY + r * 0.7);
      ictx.lineTo(iconX - r, iconY);
      ictx.quadraticCurveTo(iconX - r, iconY - r, iconX, iconY - r);
      ictx.quadraticCurveTo(iconX + r, iconY - r, iconX + r, iconY);
      ictx.lineTo(iconX + r, iconY + r * 0.7);
      ictx.lineTo(iconX + r * 0.45, iconY + r * 0.4);
      ictx.lineTo(iconX, iconY + r * 0.72);
      ictx.lineTo(iconX - r * 0.45, iconY + r * 0.4);
      ictx.closePath();
      ictx.fill();
      ictx.stroke();
      ictx.shadowBlur = 0;
      ictx.strokeStyle = fast ? '#3a1711' : '#281238';
      ictx.lineWidth = 4;
      ictx.beginPath();
      ictx.moveTo(iconX - 13, iconY - 8);
      ictx.lineTo(iconX - 4, iconY - 2);
      ictx.moveTo(iconX + 13, iconY - 8);
      ictx.lineTo(iconX + 4, iconY - 2);
      ictx.stroke();
      ictx.fillStyle = fast ? '#ffe06a' : '#ff5f79';
      ictx.beginPath();
      ictx.arc(iconX - 7, iconY + 1, 3.2, 0, Math.PI * 2);
      ictx.arc(iconX + 7, iconY + 1, 3.2, 0, Math.PI * 2);
      ictx.fill();
      if (fast) {
        ictx.strokeStyle = '#ffad45';
        ictx.lineWidth = 4;
        ictx.beginPath();
        ictx.moveTo(iconX - 50, iconY - 12);
        ictx.lineTo(iconX - 35, iconY - 12);
        ictx.moveTo(iconX - 56, iconY);
        ictx.lineTo(iconX - 38, iconY);
        ictx.moveTo(iconX - 49, iconY + 12);
        ictx.lineTo(iconX - 34, iconY + 12);
        ictx.stroke();
      }
    } else if (type === 'moving') {
      ictx.fillStyle = '#5e7592';
      roundedRectOn(ictx, iconX - 47, iconY - 4, 94, 26, 9);
      ictx.fill();
      ictx.fillStyle = '#a7d2ff';
      roundedRectOn(ictx, iconX - 47, iconY - 4, 94, 11, 8);
      ictx.fill();
      ictx.strokeStyle = '#a7d2ff';
      ictx.fillStyle = '#a7d2ff';
      ictx.lineWidth = 5;
      ictx.beginPath();
      ictx.moveTo(iconX - 44, iconY + 36);
      ictx.lineTo(iconX + 44, iconY + 36);
      ictx.moveTo(iconX, iconY - 30);
      ictx.lineTo(iconX, iconY + 52);
      ictx.stroke();
      ictx.beginPath();
      ictx.moveTo(iconX - 48, iconY + 36);
      ictx.lineTo(iconX - 32, iconY + 26);
      ictx.lineTo(iconX - 32, iconY + 46);
      ictx.closePath();
      ictx.fill();
      ictx.beginPath();
      ictx.moveTo(iconX + 48, iconY + 36);
      ictx.lineTo(iconX + 32, iconY + 26);
      ictx.lineTo(iconX + 32, iconY + 46);
      ictx.closePath();
      ictx.fill();
      ictx.beginPath();
      ictx.moveTo(iconX, iconY - 35);
      ictx.lineTo(iconX - 10, iconY - 19);
      ictx.lineTo(iconX + 10, iconY - 19);
      ictx.closePath();
      ictx.fill();
      ictx.beginPath();
      ictx.moveTo(iconX, iconY + 57);
      ictx.lineTo(iconX - 10, iconY + 41);
      ictx.lineTo(iconX + 10, iconY + 41);
      ictx.closePath();
      ictx.fill();
    } else if (type === 'conveyor') {
      ictx.fillStyle = '#4a4f5b';
      roundedRectOn(ictx, iconX - 49, iconY - 3, 98, 28, 9);
      ictx.fill();
      ictx.fillStyle = '#ffad45';
      roundedRectOn(ictx, iconX - 49, iconY - 3, 98, 11, 8);
      ictx.fill();
      ictx.strokeStyle = '#ffffff';
      ictx.lineWidth = 4;
      for (let px = iconX - 31; px <= iconX + 31; px += 31) {
        ictx.beginPath();
        ictx.moveTo(px - 8, iconY - 1);
        ictx.lineTo(px, iconY + 3);
        ictx.lineTo(px - 8, iconY + 7);
        ictx.stroke();
      }
      ictx.fillStyle = '#222630';
      for (let px = iconX - 32; px <= iconX + 32; px += 32) {
        ictx.beginPath();
        ictx.arc(px, iconY + 16, 5, 0, Math.PI * 2);
        ictx.fill();
      }
    } else if (type === 'fade') {
      ictx.save();
      ictx.globalAlpha = 0.62;
      ictx.fillStyle = '#584f87';
      roundedRectOn(ictx, iconX - 48, iconY - 4, 96, 26, 9);
      ictx.fill();
      ictx.fillStyle = '#d5b9ff';
      roundedRectOn(ictx, iconX - 48, iconY - 4, 96, 11, 8);
      ictx.fill();
      ictx.strokeStyle = 'rgba(238,226,255,0.95)';
      ictx.lineWidth = 2;
      ictx.setLineDash([7, 7]);
      roundedRectOn(ictx, iconX - 43, iconY + 1, 86, 16, 6);
      ictx.stroke();
      ictx.setLineDash([]);
      ictx.restore();
      ictx.fillStyle = '#d5b9ff';
      ictx.font = '900 12px system-ui';
      ictx.textAlign = 'center';
      ictx.fillText('100% → 30% → 0%', iconX, 74);
    } else if (type === 'ice') {
      ictx.fillStyle = '#75bad1';
      roundedRectOn(ictx, iconX - 49, iconY - 4, 98, 27, 9);
      ictx.fill();
      ictx.fillStyle = '#e8fbff';
      roundedRectOn(ictx, iconX - 49, iconY - 4, 98, 11, 8);
      ictx.fill();
      ictx.strokeStyle = 'rgba(255,255,255,0.95)';
      ictx.lineWidth = 3;
      for (let px = iconX - 31; px <= iconX + 31; px += 31) {
        ictx.beginPath();
        ictx.moveTo(px - 9, iconY + 18);
        ictx.lineTo(px + 8, iconY - 1);
        ictx.stroke();
      }
      ictx.strokeStyle = '#9feeff';
      ictx.lineWidth = 4;
      ictx.beginPath();
      ictx.moveTo(iconX - 45, 72);
      ictx.lineTo(iconX + 36, 72);
      ictx.stroke();
      ictx.fillStyle = '#9feeff';
      ictx.beginPath();
      ictx.moveTo(iconX + 48, 72);
      ictx.lineTo(iconX + 31, 62);
      ictx.lineTo(iconX + 31, 79);
      ictx.closePath();
      ictx.fill();
    } else if (type === 'spikePlatform') {
      ictx.fillStyle = '#5b4e58';
      roundedRectOn(ictx, iconX - 49, iconY - 3, 98, 28, 9);
      ictx.fill();
      ictx.fillStyle = '#ff705d';
      roundedRectOn(ictx, iconX - 49, iconY - 3, 98, 11, 8);
      ictx.fill();
      ictx.fillStyle = 'rgba(43,27,32,0.85)';
      for (let px = iconX - 34; px <= iconX + 34; px += 17) {
        roundedRectOn(ictx, px - 5, iconY + 1, 10, 4, 2);
        ictx.fill();
      }
      ictx.fillStyle = '#dce8ed';
      ictx.strokeStyle = '#ff6d57';
      ictx.lineWidth = 2;
      const count = 5;
      const step = 82 / count;
      for (let i = 0; i < count; i++) {
        const left = iconX - 41 + i * step;
        const right = iconX - 41 + (i + 1) * step;
        ictx.beginPath();
        ictx.moveTo(left + 2, iconY + 4);
        ictx.lineTo((left + right) / 2, iconY - 18);
        ictx.lineTo(right - 2, iconY + 4);
        ictx.closePath();
        ictx.fill();
        ictx.stroke();
      }
      ictx.fillStyle = '#ffc15c';
      ictx.font = '900 11px system-ui';
      ictx.textAlign = 'center';
      ictx.fillText('WARNUNG → STACHELN', iconX, 74);
    } else if (type === 'hazard') {
      ictx.fillStyle = '#6c2d32';
      roundedRectOn(ictx, 10, 46, 100, 14, 6);
      ictx.fill();
      ictx.fillStyle = '#d9e8ef';
      ictx.strokeStyle = '#ff6d57';
      ictx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const left = 14 + i * 14;
        ictx.beginPath();
        ictx.moveTo(left, 46);
        ictx.lineTo(left + 7, 28);
        ictx.lineTo(left + 14, 46);
        ictx.closePath();
        ictx.fill();
        ictx.stroke();
      }
      ictx.strokeStyle = '#ffb36a';
      ictx.fillStyle = '#ffb36a';
      ictx.lineWidth = 5;
      ictx.beginPath();
      ictx.moveTo(98, 14);
      ictx.lineTo(98, 30);
      ictx.stroke();
      ictx.beginPath();
      ictx.moveTo(98, 35);
      ictx.lineTo(90, 22);
      ictx.lineTo(106, 22);
      ictx.closePath();
      ictx.fill();
      ictx.fillStyle = '#ffd6a3';
      ictx.font = '900 11px system-ui';
      ictx.textAlign = 'left';
      ictx.fillText('Absturz = -1', 10, 17);
    } else if (type === 'life') {
      ictx.font = '900 18px system-ui';
      ictx.textAlign = 'left';
      ictx.fillStyle = '#ffffff';
      ictx.fillText('❤️❤️❤️', 10, 24);
      ictx.fillStyle = '#ffe66a';
      ictx.fillText('⭐⭐⭐', 12, 49);
      ictx.fillStyle = '#b6ff42';
      ictx.font = '900 12px system-ui';
      ictx.fillText('5 perfekte Level', 10, 68);
      ictx.fillStyle = '#d8eaf6';
      ictx.fillText('= +1 Leben', 80, 68);
    }

    ictx.restore();
  }

  function renderHowToAdvancedIcons() {
    document.querySelectorAll('.howToAdvancedIconCanvas').forEach(canvas => {
      drawHowToCanvasIcon(canvas, canvas.dataset.howtoIcon || 'pad');
    });
  }

