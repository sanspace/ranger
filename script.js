// --- Constants ---
const IPS_RESERVED_PER_RANGE = 4; // Network, Gateway, GKE-reserved, Broadcast (General subnet)
const IPS_RESERVED_PER_NODE_POD_RANGE = 2; // Network, Broadcast (Within the node's allocated pod range)

// --- Helper Functions ---

/**
 * Calculates the total number of IP addresses in a CIDR mask.
 * @param {number} mask - The CIDR mask size (e.g., 24).
 * @returns {bigint} The total number of IPs (2^(32-mask)). Uses BigInt for safety.
 */
function getTotalIPs(mask) {
    if (mask < 0 || mask > 32) {
        return 0n; // Use BigInt literal 0n
    }
    // Use BigInt power calculation
    return 2n ** BigInt(32 - mask);
}

/**
 * Calculates usable IPs in a standard GKE network range (Nodes, Services).
 * @param {number} mask - The CIDR mask size.
 * @returns {bigint} Usable IPs (Total IPs - Reserved IPs).
 */
function getUsableIPs(mask) {
    const totalIPs = getTotalIPs(mask);
    // Use BigInt for comparison and subtraction
    const reserved = BigInt(IPS_RESERVED_PER_RANGE);
    return totalIPs > reserved ? totalIPs - reserved : 0n;
}

/**
 * Determines the required Pod IP allocation per node based on maxPodsPerNode.
 * Aligns with GKE Flexible Pod CIDR logic.
 * @param {number} maxPodsPerNode - The target maximum pods per node.
 * @returns {{ maskSize: number, ips: bigint }} Object with mask size (e.g., 28) and total IPs (e.g., 16n).
 */
function getRequiredNodePodRange(maxPodsPerNode) {
    if (maxPodsPerNode <= 0) return { maskSize: 32, ips: 0n };
    if (maxPodsPerNode <= 8) return { maskSize: 28, ips: 16n };
    if (maxPodsPerNode <= 16) return { maskSize: 27, ips: 32n };
    if (maxPodsPerNode <= 32) return { maskSize: 26, ips: 64n };
    if (maxPodsPerNode <= 64) return { maskSize: 25, ips: 128n };
    if (maxPodsPerNode <= 110) return { maskSize: 24, ips: 256n }; // GKE default max often uses /24
    if (maxPodsPerNode <= 256) return { maskSize: 23, ips: 512n }; // Higher density
    // Add more ranges if needed, or handle > 256 as an error/max case
    return { maskSize: 23, ips: 512n }; // Default to largest if input is unexpectedly high
}


/**
 * Updates a visualization bar and its legend.
 * @param {string} barId - The ID of the bar div.
 * @param {string} textId - The ID of the span inside the bar.
 * @param {string} legendId - The ID of the legend div below the bar.
 * @param {bigint | number} total - The total value (denominator). BigInt or Number.
 * @param {bigint | number} used - The used value (numerator). BigInt or Number.
 * @param {string} unit - The unit label (e.g., "IPs", "Nodes").
 * @param {string} usedLabel - Label for the used portion.
 * @param {string} totalLabel - Label for the total capacity.
 */
 function updateVisualization(barId, textId, legendId, total, used, unit, usedLabel, totalLabel) {
    const barElement = document.getElementById(barId);
    const textElement = document.getElementById(textId);
    const legendElement = document.getElementById(legendId);

    // Ensure total and used are numbers for percentage calculation and BigInts for display
    const totalNum = Number(total);
    const usedNum = Number(used);
    const totalBig = BigInt(total);
    const usedBig = BigInt(used);


    let percentage = 0;
    if (totalNum > 0) {
        percentage = Math.min(100, (usedNum / totalNum) * 100); // Cap at 100%
    }

    barElement.style.width = percentage.toFixed(2) + '%';

    // Format BigInts with commas for readability
    const usedStr = usedBig.toLocaleString();
    const totalStr = totalBig.toLocaleString();

    textElement.textContent = `${usedStr} / ${totalStr} ${unit}`;
    legendElement.innerHTML = `
        <span style="color: ${barElement.style.backgroundColor}; font-weight: bold;">■</span> ${usedLabel}: ${usedStr} ${unit} <br>
        <span style="color: #e9ecef; font-weight: bold; border: 1px solid #ccc;">■</span> ${totalLabel}: ${totalStr} ${unit}
    `;
}


// --- Main Calculation Function ---
function calculateCIDRs() {
    // Get input values
    const maxPodsPerNode = parseInt(document.getElementById('maxPodsInput').value);
    const podMask = parseInt(document.getElementById('podMask').value);
    const nodeMask = parseInt(document.getElementById('nodeMask').value);
    const serviceMask = parseInt(document.getElementById('serviceMask').value);

    // --- Validation ---
    if (isNaN(maxPodsPerNode) || maxPodsPerNode < 1 ||
        isNaN(podMask) || podMask < 8 || podMask > 28 ||
        isNaN(nodeMask) || nodeMask < 8 || nodeMask > 29 ||
        isNaN(serviceMask) || serviceMask < 8 || serviceMask > 27)
     {
        alert("Please enter valid inputs.\nMax Pods: >= 1\nMasks: 8-29 (adjust based on type)");
        return;
    }
     // Pod range generally needs to be significantly larger than node range
     if (podMask >= nodeMask) {
        alert("Warning: The Pod CIDR mask (/${podMask}) should generally be smaller (cover more IPs) than the Node CIDR mask (/${nodeMask}).");
        // Allow calculation to proceed but warn user.
    }


    // --- Calculations ---

    // 1. Determine Node's Pod Range requirements
    const nodePodReq = getRequiredNodePodRange(maxPodsPerNode); // {maskSize, ips}
    const ipsAllocatedPerNode = nodePodReq.ips;
    if (ipsAllocatedPerNode === 0n) {
        alert("Invalid Max Pods per Node value.");
        return;
    }

    // 2. Pod CIDR Analysis
    const totalPodIPs = getTotalIPs(podMask);
    const maxNodesFromPodCIDR = (totalPodIPs > 0n && ipsAllocatedPerNode > 0n) ? totalPodIPs / ipsAllocatedPerNode : 0n;

    // 3. Node CIDR Analysis
    const totalNodeIPs = getTotalIPs(nodeMask);
    const usableNodeIPs = getUsableIPs(nodeMask); // Max nodes physically possible from Node range
    const maxNodesFromNodeCIDR = usableNodeIPs;

    // 4. Determine Effective Limits
    const effectiveMaxNodes = maxNodesFromPodCIDR < maxNodesFromNodeCIDR ? maxNodesFromPodCIDR : maxNodesFromNodeCIDR;
    const limitingFactor = maxNodesFromPodCIDR < maxNodesFromNodeCIDR ? `Pod CIDR (supports ${maxNodesFromPodCIDR.toLocaleString()} nodes)` : `Node CIDR (supports ${maxNodesFromNodeCIDR.toLocaleString()} nodes)`;
    const maxTotalPodsCluster = effectiveMaxNodes * BigInt(maxPodsPerNode);

    // 5. Service CIDR Analysis
    const totalServiceIPs = getTotalIPs(serviceMask);
    const usableServiceIPs = getUsableIPs(serviceMask);
    const maxServices = usableServiceIPs;

    // Determine unused counts (use BigInt for safety)
    const unusedNodeIPs = maxNodesFromNodeCIDR - effectiveMaxNodes;
    const totalPodIPsAllocated = effectiveMaxNodes * ipsAllocatedPerNode;
    const unusedPodIPs = totalPodIPs - totalPodIPsAllocated;

    // --- Display Results ---
    const summaryDiv = document.getElementById('summary');
    summaryDiv.innerHTML = `
        <p>Node Pod Allocation: Each node requires a <strong>/${nodePodReq.maskSize}</strong> range (${nodePodReq.ips.toLocaleString()} IPs) to support ${maxPodsPerNode} pods.</p>
        <p>Max Nodes (from Pod CIDR /${podMask}): <strong>${maxNodesFromPodCIDR.toLocaleString()}</strong></p>
        <p>Max Nodes (from Node CIDR /${nodeMask}): <strong>${maxNodesFromNodeCIDR.toLocaleString()}</strong></p>
        <p class="${maxNodesFromPodCIDR === maxNodesFromNodeCIDR ? '' : 'warning'}">Limiting Factor for Node Count: <strong>${limitingFactor}</strong></p>
        <p>Effective Maximum Nodes: <strong>${effectiveMaxNodes.toLocaleString()}</strong></p>
        <p>Maximum Total Pods (@${maxPodsPerNode}/node): <strong>${maxTotalPodsCluster.toLocaleString()}</strong></p>
        <p>Maximum Services (from Service CIDR /${serviceMask}): <strong>${maxServices.toLocaleString()}</strong></p>
    `;

    // --- Update Visualizations ---
    updateVisualization(
        'nodeVizBar', 'nodeVizText', 'nodeVizLegend',
        maxNodesFromNodeCIDR, // Total potential nodes from this CIDR
        effectiveMaxNodes,    // Nodes actually usable (limited by either Node or Pod CIDR)
        'Nodes',
        'Effective Max Nodes',
        'Node CIDR Capacity'
    );

    updateVisualization(
        'podVizBar', 'podVizText', 'podVizLegend',
        totalPodIPs, // Total IPs in the Pod CIDR
        effectiveMaxNodes * ipsAllocatedPerNode, // IPs allocated to the effective nodes
        'IPs',
        'Allocated Pod IPs',
        'Total Pod CIDR IPs'
    );

     updateVisualization(
        'serviceVizBar', 'serviceVizText', 'serviceVizLegend',
        totalServiceIPs, // Total IPs in the Service CIDR
        usableServiceIPs, // Usable IPs (assuming all could be used, maybe refine later)
        'IPs',
        'Usable Service IPs',
        'Total Service CIDR IPs'
    );

    // --- Update Cluster Structure Visualization ---
    // 1. Update basic numbers
    document.getElementById('struct-max-nodes').textContent = effectiveMaxNodes.toLocaleString();
    document.getElementById('struct-node-mask').textContent = nodeMask;
    document.getElementById('struct-node-pod-mask').textContent = nodePodReq.maskSize;
    document.getElementById('struct-max-pods-node').textContent = maxPodsPerNode;
    document.getElementById('struct-pod-mask').textContent = podMask;
    document.getElementById('struct-max-services').textContent = maxServices.toLocaleString();
    document.getElementById('struct-svc-mask').textContent = serviceMask;

    // 2. Update visual indicators (borders and text)
    const nodeAreaEl = document.getElementById('struct-node-area');
    const podAreaEl = document.getElementById('struct-pod-area');
    const nodeUnusedInfoEl = document.getElementById('struct-node-unused-info');
    const podUnusedInfoEl = document.getElementById('struct-pod-unused-info');

    // Reset classes and text first
    nodeAreaEl.classList.remove('has-room', 'is-limited');
    podAreaEl.classList.remove('has-room', 'is-limited'); // Pod area shows room if Node CIDR limits
    nodeUnusedInfoEl.textContent = '';
    nodeUnusedInfoEl.classList.remove('has-room-text');
    podUnusedInfoEl.textContent = '';
    podUnusedInfoEl.classList.remove('has-room-text');


    // Apply new classes and text based on the limiting factor
    if (maxNodesFromPodCIDR < maxNodesFromNodeCIDR) {
        // Pod CIDR is limiting, so Node CIDR has room
        nodeAreaEl.classList.add('has-room');
        podAreaEl.classList.add('is-limited'); // Pod allocation limits node count
        if (unusedNodeIPs > 0n) {
            nodeUnusedInfoEl.textContent = `(${unusedNodeIPs.toLocaleString()} Node IPs unused)`;
            nodeUnusedInfoEl.classList.add('has-room-text');
        }
    } else if (maxNodesFromNodeCIDR < maxNodesFromPodCIDR) {
        // Node CIDR is limiting, so Pod CIDR has room (or isn't the bottleneck)
        nodeAreaEl.classList.add('is-limited');
        podAreaEl.classList.add('has-room'); // Pod allocation has capacity relative to nodes
         // Check if there are actually unused Pod IPs in the total pool
        if (unusedPodIPs > 0n) {
             // Use a threshold? For now, just check > 0
             const threshold = ipsAllocatedPerNode; // e.g., At least one node's worth of IPs free
             if (unusedPodIPs > threshold) {
                 podUnusedInfoEl.textContent = `(~${unusedPodIPs.toLocaleString()} Pod IPs unused in pool)`;
                 podUnusedInfoEl.classList.add('has-room-text');
             } else if (unusedPodIPs > 0n) {
                 podUnusedInfoEl.textContent = `(${unusedPodIPs.toLocaleString()} Pod IPs unused in pool)`;
                  podUnusedInfoEl.classList.add('has-room-text');
             }
        }
    } else {
        // Both limits are equal (or calculation resulted in equality)
        // Treat both as potentially limiting or fully utilized - use default borders or a specific style
        nodeAreaEl.classList.add('is-limited'); // Or some 'balanced' class
        podAreaEl.classList.add('is-limited');   // Or some 'balanced' class
    }

}

// --- Event Listener ---
document.getElementById('calculateBtn').addEventListener('click', calculateCIDRs);

// --- Initial Calculation on Load --- (Optional)
document.addEventListener('DOMContentLoaded', () => {
    // You could optionally trigger a calculation on load with default values
     calculateCIDRs();
});
