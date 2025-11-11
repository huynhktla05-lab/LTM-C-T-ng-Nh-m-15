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

        private void FlashScreen_Load(object sender, EventArgs e)
        {
            timer1.Interval = 2000;
            timer1.Start();
        }

        private void timer1_Tick(object sender, EventArgs e)
        {
            timer1.Stop();
            this.Close();
        } 
    }
}