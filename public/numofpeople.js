function calculateTotalCost() {
    const startTime = document.getElementById('start_time').value;
    const endTime = document.getElementById('end_time').value;
    const numPeople = parseInt(document.getElementById('num_people').value) || 0;

    if (!startTime || !endTime) {
        document.getElementById('total_cost').value = '0';
        return;
    }

    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    const hours = (end - start) / (1000 * 60 * 60);

    if (hours <= 0) {
        alert("End Time must be after Start Time.");
        document.getElementById('total_cost').value = '0';
        return;
    }

    const costPerPersonPerHour = 20; 
    const totalCost = costPerPersonPerHour * numPeople * hours;
    document.getElementById('total_cost').value = totalCost.toFixed(2);
}

// Event listeners
document.getElementById('start_time').addEventListener('change', calculateTotalCost);
document.getElementById('end_time').addEventListener('change', calculateTotalCost);
document.getElementById('num_people').addEventListener('input', calculateTotalCost);

document.addEventListener('DOMContentLoaded', function() {
    const calculateTotalCost = () => {
        const numPeople = parseInt(document.getElementById('num_people').value) || 0;
        const startTime = document.getElementById('start_time').value;
        const endTime = document.getElementById('end_time').value;
        
        let duration = 0;
        if (startTime && endTime) {
            const start = new Date(`2000-01-01T${startTime}`);
            const end = new Date(`2000-01-01T${endTime}`);
            duration = (end - start) / (1000 * 60 * 60); // Convert to hours
        }
        
        const costPerPersonPerHour = 20; // $20 per person per hour
        const totalCost = numPeople * costPerPersonPerHour * duration;
        
        document.getElementById('total_cost').value = totalCost.toFixed(2);
    };

    // Add event listeners
    document.getElementById('num_people').addEventListener('change', calculateTotalCost);
    document.getElementById('start_time').addEventListener('change', calculateTotalCost);
    document.getElementById('end_time').addEventListener('change', calculateTotalCost);
});
