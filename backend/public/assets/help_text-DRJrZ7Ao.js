(function(){const i=document.createElement("link").relList;if(i&&i.supports&&i.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))t(e);new MutationObserver(e=>{for(const o of e)if(o.type==="childList")for(const r of o.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&t(r)}).observe(document,{childList:!0,subtree:!0});function c(e){const o={};return e.integrity&&(o.integrity=e.integrity),e.referrerPolicy&&(o.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?o.credentials="include":e.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function t(e){if(e.ep)return;e.ep=!0;const o=c(e);fetch(e.href,o)}})();const d=`
    <ul>
        <li><code>F1</code> Help Toggle</li>
        <li><code>1-9</code> Goto Drone by Index</li>
        <li><code>O</code> next / <code>P</code> previous camera (selected drone)</li>
        <li><code>W A S D Q E</code> Change Camera View for Vehicles</li>
        <li><code>L</code> Toggle Drone Labels</li>
        <li><code>T</code> Toggle Camera Trace</li>
        <li><code>R</code> Reset Camera View</li>
        <li><code>+</code>/<code>-</code> Change Drones Scale</li>
        <li><code>Space</code> Trigger Vehicle Action (selected drone)</li>
        <li><code>Ctrl+S</code> Save Multi-view Layout</li>
        <li><code>Ctrl+R</code> Restore Multi-view Layout</li>
        <li><code>Ctrl+Shift+R</code> Reset Multi-view Layout</li>
    </ul>
`;export{d as H};
