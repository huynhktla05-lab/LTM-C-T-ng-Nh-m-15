using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Text;
using System.Windows.Forms;

namespace Board
{
    public partial class FlashScreen : Form
    {
        public FlashScreen()
        {
            InitializeComponent();
        }
        int sec = 0;
        private void FlashScreen_Load(object sender, EventArgs e)
        {
            timer_Loading.Interval = 1000;
            timer_Loading.Start();
            progressBar_Loading.Minimum = 0;
            progressBar_Loading.Maximum = 100;
            progressBar_Loading.Value = 16;
            progressBar_Loading.Step = 42;
        }

        private void timer1_Tick(object sender, EventArgs e)
        {
            if(sec==2)
            {
                timer_Loading.Stop();
                this.Close();
            }
            else
            {
                progressBar_Loading.PerformStep();
                sec++;
            }
           
        } 
    }
}