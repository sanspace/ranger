# GKE CIDR Calculator (Visual)

A simple web-based tool to help plan and visualize IP address allocation for Google Kubernetes Engine (GKE) clusters, focusing on VPC-native networking and Flexible Pod CIDR allocation.

**➡️ Live Demo: [sanspace.in/ranger](https://sanspace.in/ranger)**

## Description

This calculator helps you estimate the capacity of your GKE cluster based on your desired maximum pods per node and the CIDR ranges you plan to use for Nodes, Pods, and Services. It calculates the effective maximum number of nodes, total pods, and services, highlighting potential bottlenecks in your IP allocation strategy. The tool provides visual bars to represent the utilization of your Node and Pod IP ranges.

It assumes:
* You are using a **VPC-native GKE cluster** (Alias IPs).
* GKE uses **Flexible Pod CIDR** allocation, where the IP range assigned to each node depends on the `maxPodsPerNode` setting.

## Features

* Calculates required IP allocation per node based on `maxPodsPerNode`.
* Determines the maximum node count limited by either the Node CIDR or the Pod CIDR.
* Estimates the total cluster pod capacity.
* Calculates maximum ClusterIP services.
* Visualizes Node IP usage (Effective Nodes vs. Node CIDR Capacity).
* Visualizes Pod IP usage (Allocated Pod IPs vs. Total Pod CIDR IPs).
* Identifies the limiting CIDR range for node scaling.

## How to Use

1.  **Access the tool:** Visit the live demo at **[https://sanspace.in/ranger](https://sanspace.in/ranger)**.
2.  **Enter values:** Input your desired configuration values in the fields.
3.  **Calculate:** Click the "Calculate" button.
4.  **Review results:** Analyze the summary text and the visualization bars.

Alternatively, to run locally:
1.  Clone or download this repository.
2.  Open the `index.html` file in your web browser.


## Inputs

* **Target Max Pods per Node:** The `maxPodsPerNode` value you plan to configure in GKE. This determines the IP range size allocated to each node.
* **Cluster Pod CIDR Mask (/):** The mask size (e.g., 20) for the secondary IP range used for all Pods in the cluster.
* **Cluster Node CIDR Mask (/):** The mask size (e.g., 22) for the primary IP range of the subnet where GKE nodes will reside.
* **Cluster Service CIDR Mask (/):** The mask size (e.g., 24) for the IP range used for ClusterIP Services.

## Outputs

* **Summary Text:** Details the derived allocation per node, limits imposed by each CIDR, the effective maximum nodes, total pods, and services.
* **Visualization Bars:** Graphical representation of Node and Pod IP range utilization.

## Technology

* HTML
* CSS
* JavaScript (Vanilla)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
