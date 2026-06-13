// src/pages/HomeMode.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ControllerIcon from "../assets/Controller.png";
import GlobeIcon from "../assets/Globe.png";
import AuktionshammerIcon from "../assets/Auktionshammer.png";
import SoullinkIcon from "../assets/Soullink.png";

export default function HomeMode() {
  const nav = useNavigate();
  const [friendsOpen, setFriendsOpen] = useState(false);

  function fireKeyboardShortcut({ key, code, keyCode }) {
    if (typeof document === "undefined") return;

    const target = document.activeElement || document.body || document;
    const event = new KeyboardEvent("keydown", {
      key,
      code,
      bubbles: true,
      cancelable: true,
    });

    try {
      Object.defineProperty(event, "keyCode", { get: () => keyCode });
      Object.defineProperty(event, "which", { get: () => keyCode });
    } catch {
      // ignored
    }

    target.dispatchEvent(event);
  }

  function triggerHotkey(letter) {
    const upper = letter.toUpperCase();

    fireKeyboardShortcut({
      key: letter.toLowerCase(),
      code: `Key${upper}`,
      keyCode: upper.charCodeAt(0),
    });
  }

  function openMainMenu() {
    fireKeyboardShortcut({
      key: "Escape",
      code: "Escape",
      keyCode: 27,
    });
  }

  return (
    <div className="home-mode-shell">
      <style>{`
        .home-mode-shell {
          min-height: 100vh;
          padding: 28px 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          overflow: hidden;
          position: relative;
          background: transparent;
        }

        .home-mode-shell::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 16% 18%, rgba(255, 170, 80, 0.10), transparent 32%),
            radial-gradient(circle at 82% 20%, rgba(70, 130, 220, 0.10), transparent 34%),
            radial-gradient(circle at 54% 88%, rgba(140, 120, 190, 0.08), transparent 38%);
          z-index: 0;
          pointer-events: none;
        }

        .home-mode-shell::after {
          content: "";
          position: absolute;
          width: 520px;
          height: 520px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background:
            linear-gradient(
              to bottom,
              rgba(255, 255, 255, 0.04) 0 49%,
              rgba(255, 255, 255, 0.14) 49% 51%,
              rgba(255, 255, 255, 0.025) 51% 100%
            );
          right: -180px;
          bottom: -210px;
          opacity: 0.22;
          z-index: 0;
          pointer-events: none;
        }

        .home-mode-card {
          width: min(1080px, 96vw);
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1.08fr 0.92fr;
          gap: 18px;
          padding: 18px;
          border-radius: 32px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.025)),
            rgba(7, 10, 22, 0.52);
          box-shadow:
            0 24px 90px rgba(0, 0, 0, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(12px);
        }

        .home-mode-hero {
          min-height: 440px;
          padding: 28px;
          border-radius: 26px;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          gap: 26px;
          border: 1px solid rgba(255, 255, 255, 0.13);
          background:
            radial-gradient(circle at 25% 18%, rgba(255, 180, 80, 0.10), transparent 30%),
            radial-gradient(circle at 80% 75%, rgba(90, 140, 220, 0.08), transparent 34%),
            linear-gradient(145deg, rgba(15, 21, 48, 0.58), rgba(8, 10, 24, 0.54));
        }

        .home-mode-hero::before {
          content: "";
          position: absolute;
          width: 280px;
          height: 280px;
          border-radius: 999px;
          right: -74px;
          top: -78px;
          background:
            linear-gradient(
              to bottom,
              rgba(239, 68, 68, 0.30) 0 47%,
              rgba(255, 255, 255, 0.62) 47% 53%,
              rgba(255, 255, 255, 0.10) 53% 100%
            );
          border: 14px solid rgba(255, 255, 255, 0.06);
          opacity: 0.25;
          transform: rotate(-18deg);
          pointer-events: none;
        }

        .home-mode-kicker {
          width: fit-content;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.86);
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.075);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
        }

        .home-mode-hero .home-mode-title {
          margin: 20px 0 16px;
          font-size: clamp(46px, 7vw, 86px);
          line-height: 0.88;
          font-weight: 1000;
          letter-spacing: -0.075em;
          text-align: left;
          color: white;
          text-shadow:
            0 10px 30px rgba(0, 0, 0, 0.45),
            3px 3px 0 rgba(0, 0, 0, 0.35);
        }

        .home-mode-hero .home-mode-title span {
          display: block;
          background: linear-gradient(135deg, #ffffff, #d9e6ff 48%, #e8d7ff);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: none;
        }

        .home-mode-subtitle {
          max-width: 470px;
          margin: 0;
          color: rgba(255, 255, 255, 0.76);
          font-size: 16px;
          line-height: 1.55;
          font-weight: 750;
        }

        .home-mode-quick-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 22px;
          position: relative;
          z-index: 1;
        }

        .home-mode-quick-button {
          min-width: 0;
          min-height: 84px;
          margin: 0;
          padding: 12px 14px;
          border-radius: 20px;
          border: 1px solid rgba(190, 215, 255, 0.16);
          background:
            linear-gradient(135deg, rgba(120, 145, 190, 0.22), rgba(70, 90, 135, 0.10)),
            rgba(14, 18, 34, 0.34);
          color: white;
          cursor: pointer;
          text-align: left;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 4px;
          box-shadow:
            0 8px 18px rgba(0, 0, 0, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.10);
          transition:
            transform 160ms ease,
            border-color 160ms ease,
            background 160ms ease,
            box-shadow 160ms ease,
            filter 160ms ease;
        }

        .home-mode-quick-button::before {
          content: "";
          position: absolute;
          inset: 0;
          opacity: 0;
          background:
            radial-gradient(circle at 24% 0%, rgba(180, 205, 255, 0.18), transparent 38%),
            linear-gradient(135deg, rgba(255, 255, 255, 0.06), transparent);
          transition: opacity 160ms ease;
          pointer-events: none;
        }

        .home-mode-quick-button:hover,
        .home-mode-quick-button:focus-visible {
          transform: translateY(-3px);
          border-color: rgba(210, 228, 255, 0.28);
          background:
            linear-gradient(135deg, rgba(140, 170, 225, 0.24), rgba(78, 102, 154, 0.12)),
            rgba(16, 22, 40, 0.44);
          box-shadow:
            0 14px 24px rgba(0, 0, 0, 0.22),
            0 0 22px rgba(150, 180, 255, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
          filter: brightness(1.05);
          outline: none;
        }

        .home-mode-quick-button:hover::before,
        .home-mode-quick-button:focus-visible::before {
          opacity: 1;
        }

        .home-mode-quick-button strong {
          display: block;
          position: relative;
          z-index: 1;
          font-size: 15px;
          line-height: 1.08;
          font-weight: 1000;
          letter-spacing: -0.03em;
          margin: 0;
          white-space: normal;
          overflow: visible;
        }

        .home-mode-quick-button span {
          display: block;
          position: relative;
          z-index: 1;
          color: rgba(255, 255, 255, 0.68);
          font-size: 11px;
          line-height: 1.2;
          font-weight: 850;
          white-space: normal;
          overflow: visible;
        }

        .home-mode-actions {
          display: grid;
          gap: 12px;
          align-content: start;
        }

        .home-mode-top-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 4px 4px 2px;
        }

        .home-mode-section-title h2 {
          margin: 0 0 5px;
          font-size: 26px;
          line-height: 1;
          font-weight: 1000;
          letter-spacing: -0.04em;
          color: white;
          text-shadow: none;
        }

        .home-mode-section-title p {
          margin: 0;
          color: rgba(255, 255, 255, 0.64);
          font-weight: 750;
          line-height: 1.45;
        }

        .home-mode-settings-button {
          width: 46px;
          height: 46px;
          margin: 0;
          padding: 0;
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.13);
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.095), rgba(255, 255, 255, 0.035)),
            rgba(8, 10, 20, 0.34);
          color: white;
          cursor: pointer;
          line-height: 0;
          box-shadow:
            0 10px 22px rgba(0, 0, 0, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
          transition:
            transform 160ms ease,
            border-color 160ms ease,
            background 160ms ease,
            box-shadow 160ms ease;
        }

        .home-mode-settings-button:hover,
        .home-mode-settings-button:focus-visible {
          transform: translateY(-2px);
          border-color: rgba(220, 232, 255, 0.26);
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.055)),
            rgba(12, 16, 28, 0.44);
          box-shadow:
            0 14px 26px rgba(0, 0, 0, 0.22),
            0 0 22px rgba(150, 180, 255, 0.10),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
          outline: none;
        }

        .home-mode-main-button {
          width: 100%;
          min-height: 112px;
          margin: 0;
          padding: 18px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 24px;
          color: white;
          cursor: pointer;
          text-align: left;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow:
            0 12px 26px rgba(0, 0, 0, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.10);
          transition:
            transform 160ms ease,
            border-color 160ms ease,
            box-shadow 160ms ease,
            filter 160ms ease;
        }

        .home-mode-main-button::before {
          content: "";
          position: absolute;
          inset: 0;
          opacity: 0;
          background: radial-gradient(circle at 25% 0%, rgba(255, 255, 255, 0.16), transparent 34%);
          transition: opacity 160ms ease;
          pointer-events: none;
        }

        .home-mode-main-button:hover,
        .home-mode-main-button:focus-visible {
          transform: translateY(-3px);
          border-color: rgba(205, 225, 255, 0.24);
          box-shadow:
            0 18px 34px rgba(0, 0, 0, 0.24),
            0 0 20px rgba(140, 175, 255, 0.10),
            inset 0 1px 0 rgba(255, 255, 255, 0.14);
          filter: brightness(1.04);
          outline: none;
        }

        .home-mode-main-button:hover::before,
        .home-mode-main-button:focus-visible::before {
          opacity: 1;
        }

        .home-mode-button-icon-image {
          width: 42px;
          height: 42px;
          object-fit: contain;
          display: block;
          padding: 7px;
          border-radius: 999px;
          border: 1px solid rgba(210, 228, 255, 0.22);
          background:
            radial-gradient(circle at 35% 25%, rgba(255, 255, 255, 0.14), transparent 58%),
            rgba(255, 255, 255, 0.065);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.14),
            0 0 14px rgba(150, 180, 255, 0.12);
          filter: brightness(1.08) drop-shadow(0 0 6px rgba(180, 205, 255, 0.18));
          box-sizing: border-box;
        }

        .home-mode-button-icon-image-controller {
          width: 52px;
          height: 52px;
        }

        .home-mode-lobby-image-icon {
          width: 30px;
          height: 30px;
          object-fit: contain;
          display: block;
          filter: brightness(1.08) drop-shadow(0 0 5px rgba(180, 205, 255, 0.16));
        }

        .home-mode-lobby-image-icon-soullink {
          width: 38px;
          height: 38px;
        }

        .home-mode-lobby-image-icon-globe {
          width: 42px;
          height: 42px;
        }

        .home-mode-icon-mark {
          width: 32px;
          height: 32px;
          display: block;
          position: relative;
        }

        .home-mode-icon-games {
          border-radius: 10px;
          border: 3px solid rgba(255, 255, 255, 0.86);
        }

        .home-mode-icon-games::before,
        .home-mode-icon-games::after {
          content: "";
          position: absolute;
          background: rgba(255, 255, 255, 0.86);
        }

        .home-mode-icon-games::before {
          width: 13px;
          height: 3px;
          left: 5px;
          top: 14px;
          box-shadow:
            5px -5px 0 -1px rgba(255, 255, 255, 0.86),
            5px 5px 0 -1px rgba(255, 255, 255, 0.86);
        }

        .home-mode-icon-games::after {
          width: 6px;
          height: 6px;
          right: 7px;
          top: 9px;
          border-radius: 999px;
          box-shadow: -5px 10px 0 rgba(255, 255, 255, 0.86);
        }

        .home-mode-icon-online {
          width: 24px;
          height: 24px;
        }

        .home-mode-icon-online::before {
          content: "";
          position: absolute;
          left: 9px;
          top: 2px;
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow:
            -7px 3px 0 -1px rgba(255, 255, 255, 0.92),
            7px 3px 0 -1px rgba(255, 255, 255, 0.92);
        }

        .home-mode-icon-online::after {
          content: "";
          position: absolute;
          left: 7px;
          bottom: 3px;
          width: 10px;
          height: 6px;
          border-radius: 999px 999px 6px 6px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow:
            -7px 2px 0 -1px rgba(255, 255, 255, 0.92),
            7px 2px 0 -1px rgba(255, 255, 255, 0.92);
        }

        .home-mode-icon-link {
          width: 34px;
          height: 22px;
        }

        .home-mode-icon-link::before,
        .home-mode-icon-link::after {
          content: "";
          position: absolute;
          width: 19px;
          height: 12px;
          border: 3px solid rgba(255, 255, 255, 0.86);
          border-radius: 999px;
          top: 3px;
        }

        .home-mode-icon-link::before {
          left: 0;
          transform: rotate(-28deg);
        }

        .home-mode-icon-link::after {
          right: 0;
          transform: rotate(-28deg);
        }

        .home-mode-icon-draft {
          width: 24px;
          height: 24px;
        }

        .home-mode-icon-draft::before {
          content: "";
          position: absolute;
          left: 4px;
          top: 4px;
          width: 16px;
          height: 12px;
          transform: rotate(-35deg);
          background:
            linear-gradient(rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.92)) 0 9px / 11px 2px no-repeat,
            linear-gradient(rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.92)) 8px 2px / 7px 3px no-repeat,
            linear-gradient(rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.92)) 8px 6px / 7px 3px no-repeat,
            linear-gradient(rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.92)) 10px 2px / 2px 7px no-repeat;
        }

        .home-mode-icon-draft::after {
          content: "";
          position: absolute;
          right: 2px;
          bottom: 3px;
          width: 9px;
          height: 2px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
        }

        .home-mode-icon-menu {
          width: 22px;
          height: 16px;
          display: block;
          position: relative;
          flex: 0 0 auto;
        }

        .home-mode-icon-menu::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          width: 22px;
          height: 2px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.90);
          box-shadow:
            0 7px 0 rgba(255, 255, 255, 0.90),
            0 14px 0 rgba(255, 255, 255, 0.90);
        }

        .home-mode-button-text {
          min-width: 0;
          position: relative;
          z-index: 1;
        }

        .home-mode-button-text strong {
          display: block;
          font-size: 22px;
          font-weight: 1000;
          line-height: 1.05;
          margin-bottom: 6px;
          letter-spacing: -0.03em;
        }

        .home-mode-button-text span {
          display: block;
          color: rgba(255, 255, 255, 0.70);
          font-size: 13px;
          line-height: 1.45;
          font-weight: 700;
        }

        .home-mode-arrow {
          margin-left: auto;
          width: 38px;
          height: 38px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.075);
          border: 1px solid rgba(255, 255, 255, 0.10);
          position: relative;
          z-index: 1;
        }

        .home-mode-chevron {
          width: 10px;
          height: 10px;
          display: block;
          border-right: 3px solid rgba(255, 255, 255, 0.82);
          border-bottom: 3px solid rgba(255, 255, 255, 0.82);
          border-radius: 1px;
          transition: transform 160ms ease;
        }

        .home-mode-chevron-right {
          transform: translateX(-2px) rotate(-45deg);
        }

        .home-mode-chevron-down {
          transform: translateY(-2px) rotate(45deg);
        }

        .home-mode-chevron-up {
          transform: translateY(2px) rotate(-135deg);
        }

        .home-mode-accent-games {
          background:
            linear-gradient(135deg, rgba(118, 146, 205, 0.22), rgba(68, 90, 140, 0.11)),
            rgba(14, 18, 34, 0.28);
        }

        .home-mode-accent-friends {
          background:
            linear-gradient(135deg, rgba(126, 150, 210, 0.21), rgba(72, 94, 142, 0.11)),
            rgba(14, 18, 34, 0.28);
        }

        .home-mode-accent-soullink {
          background:
            linear-gradient(135deg, rgba(122, 142, 196, 0.20), rgba(67, 86, 132, 0.10)),
            rgba(14, 18, 34, 0.28);
        }

        .home-mode-accent-draft {
          background:
            linear-gradient(135deg, rgba(116, 138, 194, 0.20), rgba(64, 84, 128, 0.10)),
            rgba(14, 18, 34, 0.28);
        }

        .home-mode-online-panel {
          display: grid;
          gap: 10px;
          padding: 12px;
          border-radius: 24px;
          border: 1px solid rgba(190, 215, 255, 0.14);
          background:
            linear-gradient(135deg, rgba(118, 146, 205, 0.14), rgba(68, 90, 140, 0.07)),
            rgba(14, 18, 34, 0.24);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.10),
            0 0 18px rgba(120, 160, 235, 0.05);
          animation: homeModeOpen 180ms ease both;
        }

        .home-mode-online-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          align-items: stretch;
        }
          
        .home-mode-small-button {
          min-height: 120px;
          margin: 0;
          padding: 14px;
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 20px;
          color: white;
          cursor: pointer;
          text-align: left;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          gap: 10px;
          box-shadow:
            0 10px 20px rgba(0, 0, 0, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.10);
          transition:
            transform 160ms ease,
            border-color 160ms ease,
            box-shadow 160ms ease,
            filter 160ms ease;
        }

        .home-mode-small-button:hover,
        .home-mode-small-button:focus-visible {
          transform: translateY(-2px);
          border-color: rgba(205, 225, 255, 0.24);
          box-shadow:
            0 14px 28px rgba(0, 0, 0, 0.20),
            0 0 18px rgba(140, 175, 255, 0.10),
            inset 0 1px 0 rgba(255, 255, 255, 0.13);
          filter: brightness(1.04);
          outline: none;
        }

        .home-mode-small-button strong {
          font-size: 19px;
          font-weight: 1000;
          letter-spacing: -0.03em;
        }

        .home-mode-small-button span {
          display: block;
          margin-top: 7px;
          color: rgba(255, 255, 255, 0.70);
          font-size: 12px;
          line-height: 1.4;
          font-weight: 750;
        }

        .home-mode-lobby-icon-circle {
          width: 50px;
          height: 50px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background:
            radial-gradient(circle at 35% 25%, rgba(255, 255, 255, 0.14), transparent 58%),
            rgba(255, 255, 255, 0.065);
          border: 1px solid rgba(210, 228, 255, 0.18);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.14),
            0 0 14px rgba(150, 180, 255, 0.10);
        }

        .home-mode-lobby-icon-circle .home-mode-icon-mark {
          transform: scale(0.78);
        }

        @keyframes homeModeOpen {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.98);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 860px) {
          .home-mode-card {
            grid-template-columns: 1fr;
          }

          .home-mode-hero {
            min-height: auto;
          }
        }

        @media (max-width: 560px) {
          .home-mode-shell {
            padding: 16px 12px;
            align-items: flex-start;
          }

          .home-mode-card {
            padding: 12px;
            border-radius: 26px;
          }

          .home-mode-hero {
            padding: 20px;
            border-radius: 22px;
          }

          .home-mode-quick-grid {
            grid-template-columns: 1fr;
          }

          .home-mode-main-button {
            min-height: 104px;
            padding: 15px;
          }

          .home-mode-button-icon {
            width: 50px;
            height: 50px;
            border-radius: 16px;
          }

          .home-mode-button-text strong {
            font-size: 20px;
          }

          .home-mode-online-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <main className="home-mode-card">
        <section className="home-mode-hero">
          <div>
            <div className="home-mode-kicker">PokeNuzTracker</div>

            <h1 className="home-mode-title">
              Run
              <span>Center</span>
            </h1>

            <p className="home-mode-subtitle">
              Tools, Spiele und Lobbys für deine nächsten Pokémon-Runs.
            </p>
          </div>

          <div className="home-mode-quick-grid">
            <button
              className="home-mode-quick-button"
              type="button"
              onClick={() => triggerHotkey("E")}
            >
              <strong>Pokédex</strong>
              <span>Pokémon suchen</span>
            </button>

            <button
              className="home-mode-quick-button"
              type="button"
              onClick={() => triggerHotkey("A")}
            >
              <strong>MoveDex</strong>
              <span>Attacken suchen</span>
            </button>

            <button
              className="home-mode-quick-button"
              type="button"
              onClick={() => triggerHotkey("C")}
            >
              <strong>Teamvergleich</strong>
              <span>Teams vergleichen</span>
            </button>
          </div>
        </section>

        <section className="home-mode-actions">
          <div className="home-mode-top-row">
            <div className="home-mode-section-title">
              <h2>Start</h2>
              <p>Wähle deinen Bereich.</p>
            </div>

            <button
              className="home-mode-settings-button"
              type="button"
              onClick={openMainMenu}
              title="Menü öffnen"
              aria-label="Menü öffnen"
            >
              <span className="home-mode-icon-mark home-mode-icon-menu" />
            </button>
          </div>

          <button
            className="home-mode-main-button home-mode-accent-games"
            type="button"
            onClick={() => nav("/games")}
          >
            <div className="home-mode-button-icon">
              <img
                src={ControllerIcon}
                alt=""
                className="home-mode-button-icon-image home-mode-button-icon-image-controller"
              />
            </div>

            <div className="home-mode-button-text">
              <strong>Pokémon Games</strong>
              <span>Starte Guess-Modi, Challenges und spätere Minispiele.</span>
            </div>

            <div className="home-mode-arrow">
              <span className="home-mode-chevron home-mode-chevron-right" />
            </div>
          </button>

          <button
            className="home-mode-main-button home-mode-accent-friends"
            type="button"
            onClick={() => setFriendsOpen((value) => !value)}
            aria-expanded={friendsOpen}
          >
            <div className="home-mode-lobby-icon-circle">
              <img
                src={GlobeIcon}
                alt=""
                className="home-mode-lobby-image-icon home-mode-lobby-image-icon-globe"
              />
            </div>

            <div className="home-mode-button-text">
              <strong>Run-Lobbys</strong>
              <span>Soullink und Draft für gemeinsame Runs.</span>
            </div>

            <div className="home-mode-arrow">
              <span
                className={`home-mode-chevron ${
                  friendsOpen ? "home-mode-chevron-up" : "home-mode-chevron-down"
                }`}
              />
            </div>
          </button>

          {friendsOpen && (
            <div className="home-mode-online-panel">
              <div className="home-mode-online-grid">
                <button
                  className="home-mode-small-button home-mode-accent-soullink"
                  type="button"
                  onClick={() => nav("/soullink")}
                >
                  <div className="home-mode-lobby-icon-circle">
                    <img
                      src={SoullinkIcon}
                      alt=""
                      className="home-mode-lobby-image-icon home-mode-lobby-image-icon-soullink"
                    />
                  </div>

                  <div>
                    <strong>Soullink</strong>
                    <span>Gemeinsame Nuzlocke-Lobby starten.</span>
                  </div>
                </button>

                <button
                  className="home-mode-small-button home-mode-accent-draft"
                  type="button"
                  onClick={() => nav("/versus")}
                >
                  <div className="home-mode-lobby-icon-circle">
                    <img
                      src={AuktionshammerIcon}
                      alt=""
                      className="home-mode-lobby-image-icon"
                    />
                  </div>

                  <div>
                    <strong>Draft</strong>
                    <span>Versus Draft und Auction-Modi öffnen.</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}